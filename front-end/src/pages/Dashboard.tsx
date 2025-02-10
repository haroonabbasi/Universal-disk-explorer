// pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  Card,
  Select,
  Button,
  Radio,
  Collapse,
  InputNumber,
  DatePicker,
  Checkbox,
  Progress,
  Tooltip,
  message
} from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { FileInfo, Filters, ScanProgress } from '../interfaces';
import { invoke } from '@tauri-apps/api/core';
import axios from 'axios';
import { open } from '@tauri-apps/plugin-dialog';
const { Panel } = Collapse;

interface DashboardProps {
  token: any;
  setFiles: (files: FileInfo[]) => void;
  setCurrentPage: (currentPage:string) => void;
  messageApi: any;
}

const Dashboard: React.FC<DashboardProps> = ({
  token,
  setFiles,
  setCurrentPage,
  messageApi,
}) => {

  const [drives, setDrives] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [progress, setProgress] = useState<ScanProgress>();
  const [mode, setMode] = useState<"scan" | "search">("scan");
  const [loading, setLoading] = useState(false);

  // Initialize state with the Filters interface
  const [filters, setFilters] = useState<Filters>({
    minSize: null,
    maxSize: null,
    fileTypes: [],
    createdBefore: null,
    modifiedBefore: null,
    lowQualityVideos: false,
    previewImage: false,
  });

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
    console.log('in here');
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
      setCurrentPage("file-explorer");
    } catch (error) {
      messageApi.error("Failed to fetch results");
      console.error("Results error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert filters for the API request.
  const convertFiltersToQueryParams = (filters: Filters) => {
    const params: any = {};

    // Convert size filters from MB to bytes.
    if (filters.minSize !== null) {
      params.min_size = filters.minSize * 1024 * 1024;
    }
    if (filters.maxSize !== null) {
      params.max_size = filters.maxSize * 1024 * 1024;
    }

    // Convert file types array to a comma-separated string.
    if (filters.fileTypes && filters.fileTypes.length > 0) {
      params.file_types = filters.fileTypes.join(',');
    }

    // Convert date objects to ISO strings.
    if (filters.createdBefore) {
      params.created_before = filters.createdBefore.toISOString();
    }
    if (filters.modifiedBefore) {
      params.modified_before = filters.modifiedBefore.toISOString();
    }

    // Direct mapping for boolean.
    params.low_quality_videos = filters.lowQualityVideos;
    params.preview_image = filters.previewImage;

    return params;
  };

  const startSearch = async () => {
    if (!selectedPath) return messageApi.warning("Please select a path first");

    setLoading(true);
    try {
      await axios.get(`http://localhost:8000/search/${encodeURIComponent(selectedPath)}`, {
        params: convertFiltersToQueryParams(filters),
      });
      messageApi.success("Search started");
      pollProgress();
    } catch (error) {
      messageApi.error("Failed to start search");
      setLoading(false);
      console.error("Search error:", error);
    }
  };

  return (
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
                  <Checkbox
                    checked={filters.previewImage}
                    onChange={e => setFilters({ ...filters, previewImage: e.target.checked })}
                  >
                    Include File Preview Image
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
};

export default Dashboard;
