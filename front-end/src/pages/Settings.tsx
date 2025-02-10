// pages/Settings.tsx
import React, {  } from 'react';
import {
  Collapse} from 'antd';
import { motion } from 'framer-motion';
import { FileInfo } from '../interfaces';
const { Panel } = Collapse;

interface SettingsProps {
  token: any;
  messageApi: any;
}

const Settings: React.FC<SettingsProps> = ({
  token,
  messageApi
}) => {

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

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      Settings
    </motion.div>
  );
};

export default Settings;
