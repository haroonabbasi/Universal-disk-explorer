import React, { useState, useMemo } from "react";
import { Input, Table, Button, Col, Dropdown, Menu, Popover, Row } from "antd";
import { SearchOutlined, DeleteOutlined, MoreOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { FileInfo } from "../interfaces";
import Thumbnail from "./Thumbnail";

// Props for our FilesTable component.
interface FilesTableProps {
  files: FileInfo[];
  onDelete: (paths: string[]) => void;
  // Optional: you can pass theme tokens if you're using a design system.
  theme?: {
    colorBgContainer: string;
    colorBorderSecondary: string;
  };
}

// Helper function to format file sizes.
const formatSize = (size: number): string => {
  if (size >= 1e9) return (size / 1e9).toFixed(2) + " GB";
  if (size >= 1e6) return (size / 1e6).toFixed(2) + " MB";
  if (size >= 1e3) return (size / 1e3).toFixed(2) + " KB";
  return size + " bytes";
};

const FilesTable: React.FC<FilesTableProps> = ({ files, onDelete, theme }) => {
  const [searchText, setSearchText] = useState<string>("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Filter files based on the search text (case-insensitive search on file name).
  const filteredFiles = useMemo(() => {
    if (!searchText) return [...files]; // Ensure new array reference
    return files.filter(file =>
      file.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [files, searchText]);

  // Delete handler will call the passed onDelete prop and reset selection.
  const handleDelete = () => {
    onDelete(selectedRowKeys);
    setSelectedRowKeys([]);
  };

  const handleOpenFile = async (path: string) => {
    try {
      await invoke("open_file", { path });
    } catch (error) {
      console.error("Error opening file:", error);
    }
  };

  // Update the screenshot rendering functions
  const getScreenshots = (file: FileInfo) => {
    // Prioritize video screenshots first
    return file.video_metadata?.video_screenshots?.length
      ? file.video_metadata.video_screenshots
      : file.screenshots || [];
  };

  const renderScreenshots = (file: FileInfo) => {
    const screenshots = getScreenshots(file);

    return (
      <Row gutter={4}>
        {screenshots.slice(0, 3).map((path, index) => (
          <Col key={index}>
            <Popover
              content={
                <div style={{
                  maxWidth: 400,
                  maxHeight: 400,
                  overflow: 'hidden',
                  display: 'flex',
                  justifyContent: 'center',
                  backgroundColor: '#f0f0f0'
                }}>
                  <Thumbnail path={path} size={400} />
                </div>
              }
              trigger="hover"
              overlayStyle={{
                maxWidth: 420 // Slightly larger than content
              }}
            >
              <div style={{ cursor: "pointer" }}>
                <Thumbnail path={path} size={50} />
              </div>
            </Popover>
          </Col>
        ))}
      </Row>
    );
  };

  // Define columns with sorters and custom renderers.
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      sorter: (a: File, b: File) => a.name.localeCompare(b.name),
    },
    {
      title: "Size",
      dataIndex: "size",
      render: (size: number) => formatSize(size),
      sorter: (a: File, b: File) => a.size - b.size,
    },
    {
      title: "Type",
      dataIndex: "file_type",
      sorter: (a: File, b: File) =>
        (a.file_type || "").localeCompare(b.file_type || ""),
    },
    {
      title: "Modified",
      dataIndex: "modified_time",
      render: (date: string | number) =>
        new Date(date).toLocaleDateString(),
      sorter: (a: File, b: File) =>
        new Date(a.modified_time).getTime() -
        new Date(b.modified_time).getTime(),
    },
    {
      title: 'Screenshots',
      render: (_: any, record: FileInfo) => renderScreenshots(record),
    },
    {
      title: 'Actions',
      render: (_: any, record: File) => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="open" onClick={() => handleOpenFile(record.path)}>
                Open
              </Menu.Item>
            </Menu>
          }
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div>
      {/* Search Input */}
      <Input
        prefix={<SearchOutlined />}
        placeholder="Search files..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{
          marginBottom: 16,
          background: theme?.colorBgContainer || "#fff",
          borderColor: theme?.colorBorderSecondary || "#d9d9d9",
        }}
      />

      {/* Files Table with row selection and animated rows */}
      <Table
        rowKey="path"
        columns={columns}
        dataSource={filteredFiles}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys: React.Key[]) =>
            setSelectedRowKeys(keys as string[]),
        }}
        pagination={{ pageSize: 50 }}
        components={{
          body: {
            row: (props: any) => (
              <motion.tr
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                {...props}
              />
            ),
          },
        }}
      />

      {/* Delete Button */}
      <Button
        danger
        icon={<DeleteOutlined />}
        onClick={handleDelete}
        disabled={selectedRowKeys.length === 0}
      >
        Delete Selected ({selectedRowKeys.length})
      </Button>
    </div>
  );
};

export default FilesTable;
