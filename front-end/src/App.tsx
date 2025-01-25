import { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { 
  Layout, 
  ConfigProvider, 
  theme, 
  Menu, 
  Button, 
  Select, 
  Card, 
  Progress, 
  Input, 
  Table, 
  message, 
  Tooltip 
} from 'antd';
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
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import axios from 'axios';

const { Header, Content, Footer, Sider } = Layout;
const { useToken } = theme;

function FileExplorerApp() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [drives, setDrives] = useState([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [progress, setProgress] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [messageApi, contextHolder] = message.useMessage();
  const { token } = useToken();

  // Page transition animations
  const pageVariants = {
    initial: { opacity: 0, x: -50 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: 50 }
  };

  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.5
  };

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
      const selected = await open({ multiple: false, directory: true });
      if (selected) setSelectedPath(selected);
    } catch (error) {
      messageApi.error("Failed to select folder");
      console.error("Folder selection error:", error);
    }
  };
  
  const startScan = async () => {
    if (!selectedPath) return messageApi.warning("Please select a path first");
  
    setLoading(true);
    try {
      await axios.get(`http://localhost:8000/scan/${encodeURIComponent(selectedPath)}`);
      messageApi.success("Scan started");
      pollProgress();
    } catch (error) {
      messageApi.error("Failed to start scan");
      setLoading(false);
      console.error("Scan error:", error);
    }
  };
  
  const pollProgress = () => {
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get<ScanProgress>("http://localhost:8000/progress");
        setProgress(data);
        if (data.status === "complete") {
          clearInterval(interval);
          fetchResults();
        }
      } catch (error) {
        clearInterval(interval);
        messageApi.error("Failed to fetch progress");
        setLoading(false);
        console.error("Progress error:", error);
      }
    }, 1000);
  };
  
  const fetchResults = async () => {
    try {
      const { data } = await axios.get<FileInfo[]>("http://localhost:8000/results");
      setFiles(data);
    } catch (error) {
      messageApi.error("Failed to fetch results");
      console.error("Results error:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) return;
  
    try {
      await axios.post("http://localhost:8000/files/delete", selectedRowKeys);
      setFiles(files.filter(file => !selectedRowKeys.includes(file.path)));
      setSelectedRowKeys([]);
      messageApi.success("Files deleted successfully");
    } catch (error) {
      messageApi.error("Failed to delete files");
      console.error("Delete error:", error);
    }
  };
  
  const formatSize = (bytes: number): string => {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  // Column definition for Table
  const columns = [
    { 
      title: "Name", 
      dataIndex: "name", 
      sorter: (a: FileInfo, b: FileInfo) => a.name.localeCompare(b.name) 
    },
    { 
      title: "Size", 
      dataIndex: "size", 
      render: (size: number) => formatSize(size), 
      sorter: (a: FileInfo, b: FileInfo) => a.size - b.size 
    },
    { 
      title: "Type", 
      dataIndex: "file_type", 
      sorter: (a: FileInfo, b: FileInfo) => (a.file_type || "").localeCompare(b.file_type || "") 
    },
    { 
      title: "Modified", 
      dataIndex: "modified_time", 
      render: (date: string) => new Date(date).toLocaleDateString() 
    },
  ];
  
  // Add these type interfaces at the top of your file
  interface ScanProgress {
    total_files: number;
    processed_files: number;
    progress_percentage: number;
    status: "scanning" | "complete";
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

  // Render methods with motion animations
  const renderDashboard = () => (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <Card 
        title="Scan Overview" 
        bordered={false} 
        style={{ 
          background: token.colorBgElevated, 
          marginBottom: 16,
          boxShadow: token.boxShadowSecondary 
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
{progress && (
  <Progress 
    percent={progress.progress_percentage} 
    strokeColor={token.colorPrimary}
    status={progress.status === 'complete' ? 'success' : 'active'}
  />
)}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <Tooltip title="Total Files Scanned">
              <Card.Grid hoverable={false} style={{ width: '33%', textAlign: 'center' }}>
                5,000 Files
              </Card.Grid>
            </Tooltip>
            <Tooltip title="Duplicate Files">
              <Card.Grid hoverable={false} style={{ width: '33%', textAlign: 'center' }}>
                120 Duplicates
              </Card.Grid>
            </Tooltip>
            <Tooltip title="Storage Saved">
              <Card.Grid hoverable={false} style={{ width: '33%', textAlign: 'center' }}>
                2.3 GB Saved
              </Card.Grid>
            </Tooltip>
          </div>
        </motion.div>
      </Card>

      <Card 
        title="Start New Scan" 
        bordered={false} 
        style={{ 
          background: token.colorBgElevated, 
          boxShadow: token.boxShadowSecondary 
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <Select
              style={{ flex: 1 }}
              placeholder="Select Drive"
              onChange={setSelectedPath}
              options={drives.map(drive => ({ label: drive, value: drive }))}
            />
            <Button 
              icon={<FolderOpenOutlined />} 
              onClick={handleSelectFolder}
              type="default"
            >
              Browse
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
        </motion.div>
      </Card>
    </motion.div>
  );

  const renderFileExplorer = () => (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="Search files..."
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ 
          marginBottom: 16, 
          background: token.colorBgContainer, 
          borderColor: token.colorBorderSecondary 
        }}
      />
      <Table
        rowKey="path"
        columns={columns}
        dataSource={files}
        rowSelection={{
          selectedRowKeys,
          onChange: keys => setSelectedRowKeys(keys)
        }}
        pagination={{ pageSize: 50 }}
        components={{
          row: ({ children, ...props }) => (
            <motion.tr
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              {...props}
            >
              {children}
            </motion.tr>
          )
        }}
      />
      <Button 
        danger 
        icon={<DeleteOutlined />} 
        onClick={handleDelete} 
        disabled={selectedRowKeys.length === 0}
      >
        Delete Selected ({selectedRowKeys.length})
      </Button>
    </motion.div>
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#fa8c16',
          colorBgBase: '#141414',
          colorBgContainer: '#1f1f1f', // Slightly lighter background for content
          colorText: '#ffffff',
          colorTextSecondary: '#a0a0a0', // Lighter secondary text color for sidebar
          borderRadius: 8
        }
      }}
    >
      {contextHolder}
      <Layout style={{ minHeight: '100vh', background: '#141414' }}>
        <Sider 
          trigger={null} 
          collapsible 
          collapsed={collapsed} 
          width={250}
          style={{ 
            background: '#1f1f1f', 
            boxShadow: '2px 0 8px rgba(0,0,0,0.15)' 
          }}
        >
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[currentPage]}
            onClick={e => setCurrentPage(e.key)}
            style={{ background: 'transparent' }}
            items={[
              { key: "dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
              { key: "file-explorer", icon: <FileSearchOutlined />, label: "File Explorer" },
              { key: "settings", icon: <SettingOutlined />, label: "Settings" }
            ]}
          />
        </Sider>
        
        <Layout>
          <Header 
            style={{ 
              background: '#0a0a0a', 
              padding: 0, 
              display: 'flex', 
              alignItems: 'center' 
            }}
          >
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ 
                color: token.colorPrimary, 
                fontSize: 18, 
                marginLeft: 16 
              }}
            />
          </Header>
          
          <Content 
            style={{ 
              margin: 16, 
              padding: 16, 
              background: '#1f1f1f', 
              borderRadius: 8 
            }}
          >
            <AnimatePresence>
              {currentPage === "dashboard" ? renderDashboard() : renderFileExplorer()}
            </AnimatePresence>
          </Content>
          
          <Footer 
            style={{ 
              textAlign: 'center', 
              color: token.colorPrimary 
            }}
          >
            Universal File Explorer © 2025
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default FileExplorerApp;