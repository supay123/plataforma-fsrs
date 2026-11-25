import { useEffect, useRef } from "react";
import { Spinner } from "./index";

/** Pide la siguiente página al llegar al final de la lista y muestra un indicador mientras carga. */
export function InfiniteScrollTrigger({ hasNextPage, isFetchingNextPage, onLoadMore }: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage || isFetchingNextPage || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onLoadMore(); });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);
  if (!hasNextPage) return null;
  return <div ref={sentinel} className="min-h-px">{isFetchingNextPage && <Spinner />}</div>;
}
