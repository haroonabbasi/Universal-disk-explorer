import React, { useState, useMemo } from "react";
import { Input, Table, Button, Col, Dropdown, Menu, Popover, Row, Select, Card } from "antd";
import { SearchOutlined, DeleteOutlined, MoreOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { FileInfo } from "../interfaces";
import Thumbnail from "./Thumbnail";

const { Option } = Select;

// Helper function to format file sizes.
const formatSize = (size: number): string => {
  if (size >= 1e9) return (size / 1e9).toFixed(2) + " GB";
  if (size >= 1e6) return (size / 1e6).toFixed(2) + " MB";
  if (size >= 1e3) return (size / 1e3).toFixed(2) + " KB";
  return size + " bytes";
};

interface FilesTableProps {
  files: FileInfo[];
  onDelete: (paths: string[]) => void;
  theme?: {
    colorBgContainer: string;
    colorBorderSecondary: string;
  };
}

const FilesTable: React.FC<FilesTableProps> = ({ files, onDelete, theme }) => {
  const [searchText, setSearchText] = useState<string>("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string | null>(null);
  const [videoCategoryFilter, setVideoCategoryFilter] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Extract unique file types from the files list.
  const fileTypes = useMemo(() => {
    const types = new Set<string>();
    files.forEach((file) => {
      if (file.file_type) {
        types.add(file.file_type);
      }
    });
    return Array.from(types);
  }, [files]);

  // Extract unique video quality categories from video files.
  const videoCategories = useMemo(() => {
    const categories = new Set<string>();
    files.forEach((file) => {
      const category = file.video_metadata?.video_qauality_result?.category;
      if (category) {
        categories.add(category);
      }
    });
    return Array.from(categories);
  }, [files]);

  // Filter files based on search text and the additional filters.
  const filteredFiles = useMemo(() => {
    let filtered = [...files];

    if (searchText) {
      filtered = filtered.filter((file) =>
        file.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (fileTypeFilter) {
      filtered = filtered.filter((file) => file.file_type === fileTypeFilter);
    }

    if (videoCategoryFilter) {
      filtered = filtered.filter(
        (file) =>
          file.video_metadata &&
          file.video_metadata.video_qauality_result &&
          file.video_metadata.video_qauality_result.category === videoCategoryFilter
      );
    }

    return filtered;
  }, [files, searchText, fileTypeFilter, videoCategoryFilter]);

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

  const handleOpenFileFolder = async (path: string) => {
    try {
      await invoke("open_file_folder", { path });
    } catch (error) {
      console.error("Error opening file folder:", error);
    }
  };

  // Render screenshots for a file.
  const getScreenshots = (file: FileInfo) => {
    return file.video_metadata?.video_screenshots?.length
      ? file.video_metadata.video_screenshots
      : file.screenshots || [];
  };

  const renderScreenshots = (file: FileInfo) => {
    const screenshots = getScreenshots(file);
    return (
      <Row gutter={4}>
                {/* <Image.PreviewGroup
          preview={{
            onChange: (current, prev) => console.log(`current index: ${current}, prev index: ${prev}`),
          }}
        >
          <Image width={200} src="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg" />
          <Image
            width={200}
            src="https://gw.alipayobjects.com/zos/antfincdn/aPkFc8Sj7n/method-draw-image.svg"
          />
        </Image.PreviewGroup> */}
        {screenshots.slice(0, 3).map((path, index) => (
          <Col key={index}>
            <Popover
              content={
                <div
                  style={{
                    maxWidth: 400,
                    maxHeight: 400,
                    overflow: "hidden",
                    display: "flex",
                    justifyContent: "center",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  <Thumbnail path={path} size={400} />
                </div>
              }
              trigger="hover"
              overlayStyle={{
                maxWidth: 420,
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

  // Define columns for the table.
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      sorter: (a: FileInfo, b: FileInfo) => a.name.localeCompare(b.name),
    },
    {
      title: "Size",
      dataIndex: "size",
      render: (size: number) => formatSize(size),
      sorter: (a: FileInfo, b: FileInfo) => a.size - b.size,
    },
    {
      title: "Type",
      dataIndex: "file_type",
      sorter: (a: FileInfo, b: FileInfo) =>
        (a.file_type || "").localeCompare(b.file_type || ""),
    },
    {
      title: "Category",
      // This column shows video quality category if available
      render: (_: any, record: FileInfo) =>
        record.video_metadata?.video_qauality_result?.category || "",
      sorter: (a: FileInfo, b: FileInfo) => {
        const catA = a.video_metadata?.video_qauality_result?.category || "";
        const catB = b.video_metadata?.video_qauality_result?.category || "";
        return catA.localeCompare(catB);
      },
    },
    {
      title: "Modified",
      dataIndex: "modified_time",
      render: (date: string | number) => new Date(date).toLocaleDateString(),
      sorter: (a: FileInfo, b: FileInfo) =>
        new Date(a.modified_time).getTime() - new Date(b.modified_time).getTime(),
    },
    {
      title: "Screenshots",
      render: (_: any, record: FileInfo) => renderScreenshots(record),
    },
    {
      title: "Actions",
      render: (_: any, record: FileInfo) => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="open" onClick={() => handleOpenFile(record.path)}>
                Open File
              </Menu.Item>
              <Menu.Item key="open_folder" onClick={() => handleOpenFileFolder(record.path)}>
                Open Folder
              </Menu.Item>
            </Menu>
          }
          trigger={["click"]}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div>
      {/* Search and Filter Section */}
      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search files..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            marginBottom: 8,
            background: theme?.colorBgContainer || "#fff",
            borderColor: theme?.colorBorderSecondary || "#d9d9d9",
          }}
        />
        <Row gutter={16}>
          <Col>
            <Select
              allowClear
              placeholder="Filter by file type"
              style={{ width: 200 }}
              value={fileTypeFilter || undefined}
              onChange={(value) => setFileTypeFilter(value)}
            >
              {fileTypes.map((type) => (
                <Option key={type} value={type}>
                  {type}
                </Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              allowClear
              placeholder="Filter by video category"
              style={{ width: 200 }}
              value={videoCategoryFilter || undefined}
              onChange={(value) => setVideoCategoryFilter(value)}
            >
              {videoCategories.map((cat) => (
                <Option key={cat} value={cat}>
                  {cat}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </div>

      {/* Files Table */}
      <Table
        rowKey="path"
        columns={columns}
        dataSource={filteredFiles}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
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
