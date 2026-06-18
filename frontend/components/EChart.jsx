"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function EChart({ option, height = 320, className = "", onEvents = {} }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) {
      return undefined;
    }

    const instance = echarts.init(chartRef.current);
    instanceRef.current = instance;

    const resizeObserver = new ResizeObserver(() => {
      instance.resize();
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (instanceRef.current && option) {
      instanceRef.current.setOption(option, true);
    }
  }, [option]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) {
      return undefined;
    }

    Object.entries(onEvents).forEach(([eventName, handler]) => {
      instance.on(eventName, handler);
    });

    return () => {
      Object.entries(onEvents).forEach(([eventName, handler]) => {
        instance.off(eventName, handler);
      });
    };
  }, [onEvents]);

  return <div ref={chartRef} className={className} style={{ width: "100%", height }} />;
}
