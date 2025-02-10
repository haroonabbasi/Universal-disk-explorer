import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

interface ThumbnailResponse {
  data_url: string;
  width: number;
  height: number;
}

const Thumbnail: React.FC<{ path: string; size?: number }> = ({ path, size = 50 }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchThumbnail = async () => {
      try {
        const response: ThumbnailResponse = await invoke("get_thumbnail", { path });
        if (isMounted) {
          setSrc(response.data_url);
          setError(false);
        }
      } catch (err) {
        console.error('Thumbnail load error:', err); // Add error logging
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchThumbnail();
    return () => { isMounted = false; };
  }, [path]);

  if (loading) return <div style={{ width: size, height: size }}>Loading...</div>;
  if (error) return <div style={{ width: size, height: size }}>⚠️</div>;

  return (
    <img
      src={src}
      alt="Thumbnail"
      style={{ 
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: 4
      }}
    />
  );
};
export default Thumbnail;