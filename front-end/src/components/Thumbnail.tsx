import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

const Thumbnail: React.FC<{ path: string }> = ({ path }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchThumbnail = async () => {
      try {
        const dataUrl: string = await invoke("get_thumbnail", { path });
        if (isMounted) {
          setSrc(dataUrl);
          setError(false);
        }
      } catch (err) {
        debugger;
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchThumbnail();
    return () => { isMounted = false; };
  }, [path]);

  if (loading) return <div className="thumbnail-loading">Loading...</div>;
  if (error) return <div className="thumbnail-error">⚠️</div>;

  return (
    <img
      src={src}
      alt="Thumbnail"
      style={{ 
        width: 50,
        height: 50,
        objectFit: "cover",
        borderRadius: 4
      }}
    />
  );
};
export default Thumbnail;