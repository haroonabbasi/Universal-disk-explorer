import { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { Layout, Select, Button, Table, Input, Progress, message, theme, Menu } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  SearchOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  SettingOutlined
} from '@ant-design/icons';
import axios from 'axios';
import './App.css';

const { Header, Content, Footer, Sider } = Layout;

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
  const [collapsed, setCollapsed] = useState(false);
  const [drives, setDrives] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Fetch available drives on mount
  useEffect(() => {
    const getDrives = async () => {
      try {
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
      <Layout style={{ minHeight: '100vh' }}>
        <Sider trigger={null} collapsible collapsed={collapsed}>
          <div className="demo-logo-vertical" />
          <div className="text-white text-center py-4 px-2 overflow-hidden whitespace-nowrap">
            {!collapsed && 'Universal Disk Explorer'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            defaultSelectedKeys={['1']}
            items={[
              {
                key: '1',
                icon: <DashboardOutlined />,
                label: 'Dashboard',
              },
              {
                key: '2',
                icon: <FileSearchOutlined />,
                label: 'File Explorer',
              },
              {
                key: '3',
                icon: <SettingOutlined />,
                label: 'Settings',
              },
            ]}
          />
        </Sider>
        <Layout>
          <Header style={{ padding: 0, background: colorBgContainer }}>
            <div className="flex justify-between items-center px-4">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: '16px',
                  width: 64,
                  height: 64,
                }}
              />
              <div className="flex gap-4">
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
            </div>
          </Header>

          <Content
            style={{
              margin: '24px 16px',
              padding: 24,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {selectedPath && (
              <div className="text-gray-500 mb-4">
                Selected: {selectedPath}
              </div>
            )}

            {progress && (
              <div className="mb-6">
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

          <Footer style={{ textAlign: 'center' }}>
            Universal Disk Explorer ©2025
          </Footer>
        </Layout>
      </Layout>
    </>
  );
}

export default App;