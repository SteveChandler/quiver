import dynamic from "next/dynamic";
import { ReactNode } from "react";

interface NoSSRProps {
  children: ReactNode;
  fallback?: ReactNode;
}

const NoSSR = ({ children, fallback = null }: NoSSRProps) => {
  return <>{children}</>;
};

export default dynamic(() => Promise.resolve(NoSSR), {
  ssr: false,
});
