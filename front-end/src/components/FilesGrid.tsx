import React, { useState, useMemo } from "react";
import { Input, Card, Checkbox, Button } from "antd";
import { SearchOutlined, DeleteOutlined } from "@ant-design/icons";

// Define the File interface.
export interface File {
  path: string;
  name: string;
  size: number;
  file_type?: string;
  modified_time: string | number;
}

interface FilesGridProps {
  files: File[];
  onDelete: (paths: string[]) => void;
  theme?: {
    colorBgContainer: string;
    colorBorderSecondary: string;
  };
}

const FilesGrid: React.FC<FilesGridProps> = ({ files, onDelete, theme }) => {
  const [searchText, setSearchText] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Filter files based on the search text (case-insensitive search on file name).
  const filteredFiles = useMemo(() => {
    if (!searchText) return files;
    return files.filter((file) =>
      file.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [files, searchText]);

  // Check if all filtered files are selected.
  const allSelected =
    filteredFiles.length > 0 &&
    filteredFiles.every((file) => selectedKeys.includes(file.path));

  // Toggle select/deselect all filtered files.
  const toggleSelectAll = () => {
    if (allSelected) {
      // Deselect all filtered files.
      const updatedSelection = selectedKeys.filter(
        (key) => !filteredFiles.some((file) => file.path === key)
      );
      setSelectedKeys(updatedSelection);
    } else {
      // Select all filtered files.
      const newKeys = [
        ...new Set([...selectedKeys, ...filteredFiles.map((file) => file.path)]),
      ];
      setSelectedKeys(newKeys);
    }
  };

  // Toggle individual file selection.
  const handleFileSelect = (path: string, checked: boolean) => {
    if (checked) {
      setSelectedKeys((prev) => [...prev, path]);
    } else {
      setSelectedKeys((prev) => prev.filter((key) => key !== path));
    }
  };

  // Handle delete action.
  const handleDelete = () => {
    onDelete(selectedKeys);
    setSelectedKeys([]);
  };

  return (
    <div>
      {/* Top Bar: Search Input and Select All */}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search files..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            flex: 1,
            background: theme?.colorBgContainer || "#fff",
            borderColor: theme?.colorBorderSecondary || "#d9d9d9",
          }}
        />
        <Checkbox checked={allSelected} onChange={toggleSelectAll}>
          Select All
        </Checkbox>
      </div>

      {/* Files Grid */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {filteredFiles.map((file) => (
          <Card key={file.path} style={{ width: 200 }}>
            {/* Checkbox and File Name */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Checkbox
                checked={selectedKeys.includes(file.path)}
                onChange={(e) => handleFileSelect(file.path, e.target.checked)}
              />
              <span>{file.name}</span>
            </div>
            {/* File Preview */}
            <div>
              {file.file_type === ".mp4" ? (
                <video
                  src={file.path}
                  style={{ width: "100%", height: "auto" }}
                  controls
                />
              ) : (
                <img
                  src={file.path}
                  alt={file.name}
                  style={{ width: "100%", height: "auto" }}
                />
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Delete Button */}
      <Button
        danger
        icon={<DeleteOutlined />}
        onClick={handleDelete}
        disabled={selectedKeys.length === 0}
        style={{ marginTop: 16 }}
      >
        Delete Selected ({selectedKeys.length})
      </Button>
    </div>
  );
};

export default FilesGrid;
