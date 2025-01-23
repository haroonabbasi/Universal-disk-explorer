// src/App.tsx
import { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { Layout, Select, Button, Table, Input, Progress, message } from 'antd';
import { FolderOpenOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import './App.css';

const { Header, Content, Footer } = Layout;

interface ScanProgress {
  total_files: number;
  processed_files: number;
  progress_percentage: number;
  status: 'scanning' | 'complete';
  elapsed_time: string;
  estimated_time_remaining: string;
  files_per_second: number;
}

interface FileInfo {
  path: string;
  name: string;
  size: number;
  created_time: string;
  modified_time: string;
  file_type: string;
  mime_type: string;
  hash: string;
  is_directory: boolean;
}

function App() {
  const [drives, setDrives] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  // Fetch available drives on mount
  useEffect(() => {
    const getDrives = async () => {
      try {
        // Updated Tauri 2.0 invoke pattern
        const driveList = await invoke<string[]>('get_drives');
        setDrives(driveList);
      } catch (error) {
        messageApi.error('Failed to get drives');
        console.error('Drive error:', error);
      }
    };

    getDrives();
  }, []);

  const handleSelectFolder = async () => {
    try {
      // Using Tauri 2.0 dialog command
      const selected = await invoke<string>('select_folder');
      if (selected) {
        setSelectedPath(selected);
      }
    } catch (error) {
      messageApi.error('Failed to select folder');
      console.error('Folder selection error:', error);
    }
  };

  const startScan = async () => {
    if (!selectedPath) {
      return messageApi.warning('Please select a path first');
    }

    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:8000/scan/${encodeURIComponent(selectedPath)}`);
      messageApi.success('Scan started');
      pollProgress();
    } catch (error) {
      messageApi.error('Failed to start scan');
      setLoading(false);
      console.error('Scan error:', error);
    }
  };

  const pollProgress = () => {
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get<ScanProgress>('http://localhost:8000/progress');
        setProgress(data);

        if (data.status === 'complete') {
          clearInterval(interval);
          fetchResults();
        }
      } catch (error) {
        clearInterval(interval);
        messageApi.error('Failed to fetch progress');
        setLoading(false);
        console.error('Progress error:', error);
      }
    }, 1000);
  };

  const fetchResults = async () => {
    try {
      const { data } = await axios.get<FileInfo[]>('http://localhost:8000/results');
      setFiles(data);
    } catch (error) {
      messageApi.error('Failed to fetch results');
      console.error('Results error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) return;

    try {
      await axios.post('http://localhost:8000/files/delete', selectedRowKeys);
      setFiles(files.filter(file => !selectedRowKeys.includes(file.path)));
      setSelectedRowKeys([]);
      messageApi.success('Files deleted successfully');
    } catch (error) {
      messageApi.error('Failed to delete files');
      console.error('Delete error:', error);
    }
  };

  const formatSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a: FileInfo, b: FileInfo) => a.name.localeCompare(b.name),
      filteredValue: [searchText],
      onFilter: (value: string, record: FileInfo) =>
        record.name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      render: (size: number) => formatSize(size),
      sorter: (a: FileInfo, b: FileInfo) => a.size - b.size,
    },
    {
      title: 'Type',
      dataIndex: 'file_type',
      sorter: (a: FileInfo, b: FileInfo) => 
        (a.file_type || '').localeCompare(b.file_type || ''),
    },
    {
      title: 'Modified',
      dataIndex: 'modified_time',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: FileInfo, b: FileInfo) => 
        new Date(a.modified_time).getTime() - new Date(b.modified_time).getTime(),
    },
  ];

  return (
    <>
      {contextHolder}
      <Layout className="min-h-screen">
        <Header className="flex items-center justify-between px-6">
          <h1 className="text-white text-xl m-0">Universal Disk Explorer</h1>
        </Header>

        <Content className="p-6">
          <div className="mb-6 text-center">
            <div className="flex justify-center gap-4 mb-4">
              <Select
                style={{ width: 200 }}
                placeholder="Select Drive"
                onChange={setSelectedPath}
                options={drives.map(drive => ({ label: drive, value: drive }))}
              />
              
              <Button 
                icon={<FolderOpenOutlined />}
                onClick={handleSelectFolder}
              >
                Select Folder
              </Button>
              
              <Button
                type="primary"
                loading={loading}
                onClick={startScan}
                disabled={!selectedPath}
              >
                Start Scan
              </Button>
            </div>

            {selectedPath && (
              <div className="text-gray-500">
                Selected: {selectedPath}
              </div>
            )}
          </div>

          {progress && (
            <div className="mb-6 text-center">
              <Progress 
                percent={progress.progress_percentage} 
                status={loading ? 'active' : 'normal'}
              />
              <div className="mt-2 text-gray-500">
                {progress.processed_files} / {progress.total_files} files processed
                ({progress.progress_percentage.toFixed(1)}%)
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div>
              <div className="flex justify-between mb-4">
                <Input
                  placeholder="Search files..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  style={{ maxWidth: 300 }}
                />
                
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                  disabled={selectedRowKeys.length === 0}
                >
                  Delete Selected ({selectedRowKeys.length})
                </Button>
              </div>

              <Table
                rowKey="path"
                columns={columns}
                dataSource={files}
                rowSelection={{
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys as string[]),
                }}
                pagination={{ pageSize: 50 }}
              />
            </div>
          )}
        </Content>

        <Footer className="text-center">
          Universal Disk Explorer ©2025
        </Footer>
      </Layout>
    </>
  );
}

export default App;