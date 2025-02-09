// pages/FileExplorer.tsx
import React, { useEffect, useState } from 'react';
import { Layout, Button, Tree, message } from 'antd';
import { motion } from 'framer-motion';
import FilesTable from '../components/FilesTable';
import FilesGrid from '../components/FilesGrid';
import { DataNode } from 'antd/es/tree';
import { FileInfo } from '../interfaces';
import axios from 'axios';

const { Sider, Content } = Layout;

interface FileExplorerProps {
  token: any;
  files: FileInfo[];
  setFiles: (files: FileInfo[]) => void;
  messageApi: any;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  token,
  files,
  setFiles,
  messageApi
}) => {

  // const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [filteredFiles, setFilteredFiles] = useState<FileInfo[]>([]);
  const [folderTree, setFolderTree] = useState<DataNode[]>();
  const [selectedPath, setSelectedPath] = useState("");


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


  const handleFolderSelect = (selectedKeys: string | any[]) => {
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
    return Object.keys(node).map((key): any => {
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

  const handleDelete = async (selectedRowKeys: string | string[]) => {
    if (selectedRowKeys.length === 0) return;

    try {
      await axios.post("http://localhost:8000/files/delete", selectedRowKeys);
      setFiles(files.filter((file: FileInfo) => !selectedRowKeys.includes(file.path)));
      // setSelectedRowKeys([]);
      messageApi.success("Files deleted successfully");
    } catch (error) {
      messageApi.error("Failed to delete files");
      console.error("Delete error:", error);
    }
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
    viewMode === "list" ?
      <FilesTable files={filteredFiles} onDelete={handleDelete} theme={token} /> :
      <FilesGrid files={filteredFiles} onDelete={handleDelete} theme={token} />
  );

  return (
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
};

export default FileExplorer;
