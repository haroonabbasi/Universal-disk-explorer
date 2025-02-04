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
  Progress, Table,
  message,
  Tooltip,
  Radio,
  Collapse,
  InputNumber,
  DatePicker,
  Checkbox,
  Tree
} from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FolderOpenOutlined, DashboardOutlined,
  FileSearchOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import axios from 'axios';
import { ScanProgress, FileInfo } from "./interfaces";
import { DataNode } from 'antd/es/tree';
import FilesTable from './components/FilesTable';
import FilesGrid from './components/FilesGrid';

const { Header, Content, Footer, Sider } = Layout;
const { useToken } = theme;

function FileExplorerApp() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [drives, setDrives] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [progress, setProgress] = useState<ScanProgress>();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const { token } = useToken();

  const [mode, setMode] = useState<"scan" | "search">("scan");
  const [filters, setFilters] = useState({
    minSize: null,
    maxSize: null,
    fileTypes: [],
    createdBefore: null,
    modifiedBefore: null,
    lowQualityVideos: false,
  });

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
        } else if (data.status === "error") {
          clearInterval(interval);
          setLoading(false);
          messageApi.error("Scanned Failed - " + data.error);
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
      setFiles(files.filter((file: FileInfo) => !selectedRowKeys.includes(file.path)));
      setSelectedRowKeys([]);
      messageApi.success("Files deleted successfully");
    } catch (error) {
      messageApi.error("Failed to delete files");
      console.error("Delete error:", error);
    }
  };

  const startSearch = async () => {
    if (!selectedPath) return messageApi.warning("Please select a path first");

    setLoading(true);
    try {
      await axios.get(`http://localhost:8000/search/${encodeURIComponent(selectedPath)}`, {
        params: filters,
      });
      messageApi.success("Search started");
      pollProgress();
    } catch (error) {
      messageApi.error("Failed to start search");
      setLoading(false);
      console.error("Search error:", error);
    }
  };




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
          </div>

          <div style={{ marginBottom: 16 }}>
            <Radio.Group value={mode} onChange={e => setMode(e.target.value)}>
              <Radio.Button value="scan">Scan</Radio.Button>
              <Radio.Button value="search">Search</Radio.Button>
            </Radio.Group>
          </div>

          {mode === "search" && (
            <Collapse defaultActiveKey={[]}>
              <Collapse.Panel header="Filters" key="filters">
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <InputNumber
                    placeholder="Min Size (MB)"
                    onChange={value => setFilters({ ...filters, minSize: value })}
                  />
                  <InputNumber
                    placeholder="Max Size (MB)"
                    onChange={value => setFilters({ ...filters, maxSize: value })}
                  />
                  <Select
                    mode="multiple"
                    placeholder="File Types"
                    onChange={value => setFilters({ ...filters, fileTypes: value })}
                    options={[
                      { label: "Images", value: "image" },
                      { label: "Videos", value: "video" },
                      { label: "Documents", value: "document" },
                    ]}
                  />
                  <DatePicker
                    placeholder="Created Before"
                    onChange={date => setFilters({ ...filters, createdBefore: date })}
                  />
                  <DatePicker
                    placeholder="Modified Before"
                    onChange={date => setFilters({ ...filters, modifiedBefore: date })}
                  />
                  <Checkbox
                    checked={filters.lowQualityVideos}
                    onChange={e => setFilters({ ...filters, lowQualityVideos: e.target.checked })}
                  >
                    Low-Quality Videos
                  </Checkbox>
                </div>
              </Collapse.Panel>
            </Collapse>
          )}

          <Button
            type="primary"
            loading={loading}
            onClick={mode === "scan" ? startScan : startSearch}
            disabled={!selectedPath}
            style={{ marginTop: 16 }}
          >
            {mode === "scan" ? "Start Scan" : "Start Search"}
          </Button>
        </motion.div>
      </Card>
    </motion.div>
  );

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // useEffect(() => {
  //   if (files.length > 0) {
  //     const treeData = getFolderTree(files);
  //     setFolderTree([{ title: "All", key: "ALL", children: treeData }]);
  //     setFilteredFiles(files); // Show all files by default
  //   }
  // }, [files]);
  const [filteredFiles, setFilteredFiles] = useState<FileInfo[]>([]);
  const [folderTree, setFolderTree] = useState<DataNode[]>();

  const handleFolderSelect = (selectedKeys) => {
    if (selectedKeys.length === 0) return; // Safeguard: Exit if no folder is selected

    const selectedPath = selectedKeys[0];
    setSelectedPath(selectedPath);

    if (selectedPath === "ALL") {
      setFilteredFiles(files); // Show all files
    } else {
      const filtered = filterFilesByFolder(files, selectedPath);
      setFilteredFiles(filtered);
    }
  };

  const filterFilesByFolder = (files: FileInfo[], folderPath: string) => {
    if (!folderPath) return files; // Safeguard: Return all files if folderPath is undefined

    // Normalize the folder path to ensure it ends with a '/'
    const normalizedFolderPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

    // Filter files that are in the selected folder or its subfolders
    return files.filter(file => file.path.startsWith(normalizedFolderPath));
  };

  const buildFolderTree = (files: FileInfo[]) => {
    const root = {};

    files.forEach(file => {
      const parts = file.path.split('/').filter(part => part !== ''); // Split path into components
      let currentLevel = root;

      // Traverse the path and build the folder structure
      for (let i = 0; i < parts.length - 1; i++) { // Skip the last part (file name)
        const part = parts[i];
        if (!currentLevel[part]) {
          currentLevel[part] = {};
        }
        currentLevel = currentLevel[part];
      }
    });

    return root;
  };

  const convertToTreeData = (node: Record<string, any>, path: string = '') => {
    return Object.keys(node).map(key => {
      const fullPath = path ? `${path}/${key}` : `/${key}`; // Ensure keys start with '/'
      return {
        title: key,
        key: fullPath,
        children: convertToTreeData(node[key], fullPath),
      };
    });
  };
  const getFolderTree = (files: FileInfo[]) => {
    const folderStructure = buildFolderTree(files);
    return convertToTreeData(folderStructure);
  };

  useEffect(() => {
    if (files.length > 0) {
      const treeData = getFolderTree(files);
      console.log('treeData:', treeData);
      console.log('treeData:', JSON.stringify(treeData));
      setFolderTree([{ title: "All", key: "ALL", children: treeData }]);
      setFilteredFiles(files); // Show all files by default
    }
  }, [files]);

  const renderFileView = () => (
    viewMode === "list" ? <FilesTable files={files} onDelete={handleDelete} theme={token} /> : <FilesGrid files={files} onDelete={handleDelete} theme={theme} />
  );

  const renderFileExplorer = () => (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <Layout style={{ display: 'flex', flexDirection: 'row', gap: 16 }}>
        <Sider width={250} style={{ background: token.colorBgContainer }}>
          <Tree
            treeData={folderTree}
            onSelect={handleFolderSelect}
            defaultExpandAll
          />
        </Sider>
        <Content style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}>
              Switch to {viewMode === "list" ? "Grid" : "List"} View
            </Button>
          </div>
          {renderFileView()}
        </Content>
      </Layout>
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