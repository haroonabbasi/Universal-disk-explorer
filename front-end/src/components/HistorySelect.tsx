import React, { useEffect, useState } from "react";
import { Select, Spin } from "antd";
import axios from "axios";
import { message } from "antd";

const { Option } = Select;

interface HistoryResponse {
  scans: string[];
  searches: string[];
}

// Extend the props to include any additional properties such as style
interface HistorySelectProps extends React.ComponentProps<typeof Select> {
  onSelect: (selectedValue: string) => void;
}

const HistorySelect: React.FC<HistorySelectProps> = ({ onSelect, style, ...rest }) => {
  const [history, setHistory] = useState<HistoryResponse>({ scans: [], searches: [] });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    axios
      .get<HistoryResponse>("http://localhost:8000/history")
      .then((response) => {
        setHistory(response.data);
      })
      .catch((error) => {
        message.error("Failed to fetch history");
        console.error("History error:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <Spin />;
  }

  // Combine scan and search results with a prefix for clarity
  const options = [
    ...history.scans.map((file) => ({ label: `Scan: ${file}`, value: file })),
    ...history.searches.map((file) => ({ label: `Search: ${file}`, value: file })),
  ];

  return (
    <Select
      showSearch
      style={style}
      placeholder="Select a history file"
      optionFilterProp="label"
      onChange={(value) => {
        onSelect(value);
      }}
      filterOption={(input, option) =>
        (option?.label as string).toLowerCase().includes(input.toLowerCase())
      }
      {...rest}
    >
      {options.map((opt) => (
        <Option key={opt.value} value={opt.value}>
          {opt.label}
        </Option>
      ))}
    </Select>
  );
};

export default HistorySelect;
