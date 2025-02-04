import React, { useState, useMemo } from "react";
import { Input, Table, Button } from "antd";
import { SearchOutlined, DeleteOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";

// Define the File interface for TypeScript.
export interface File {
  path: string;
  name: string;
  size: number;
  file_type?: string;
  modified_time: string | number;
}

// Props for our FilesTable component.
interface FilesTableProps {
  files: File[];
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
    if (!searchText) return files;
    return files.filter((file) =>
      file.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [files, searchText]);

  // Delete handler will call the passed onDelete prop and reset selection.
  const handleDelete = () => {
    onDelete(selectedRowKeys);
    setSelectedRowKeys([]);
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
