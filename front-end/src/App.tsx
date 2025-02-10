import { useState } from 'react';
import {
  Layout,
  ConfigProvider,
  theme,
  Menu,
  Button,

  message
} from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { AnimatePresence } from 'framer-motion';
import { FileInfo } from "./interfaces";
import FileExplorer from './pages/FileExplorer';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import axios from 'axios';

const { Header, Content, Footer, Sider } = Layout;
const { useToken } = theme;

function FileExplorerApp() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const { token } = useToken();

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
              {(() => {
                const pages: Record<string, JSX.Element> = {
                  dashboard: <Dashboard setFiles={setFiles} messageApi={messageApi} token={token} setCurrentPage={setCurrentPage} />,
                  "file-explorer": <FileExplorer setFiles={setFiles} messageApi={messageApi} files={files} token={token} />,
                  settings: <Settings messageApi={messageApi} token={token} />
                };
                return pages[currentPage] || <Dashboard setFiles={setFiles} messageApi={messageApi} token={token} setCurrentPage={setCurrentPage} />;
              })()}
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