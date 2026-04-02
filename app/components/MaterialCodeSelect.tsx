'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Select, Spin, message } from 'antd';
import debounce from 'lodash/debounce';

export type MaterialCodeItem = {
  code: string;
  name: string;
  level: number;
  parentCode: string | null;
};

type Props = {
  value?: MaterialCodeItem | null;
  onChange: (val: MaterialCodeItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function MaterialCodeSelect({
  value,
  onChange,
  placeholder = '请输入物料编码或名称搜索并选择',
  disabled,
}: Props) {
  const [options, setOptions] = useState<MaterialCodeItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const lastQueryRef = useRef('');

  const fetchOptions = async (q: string) => {
    const query = q.trim();
    lastQueryRef.current = query;
    if (!query) {
      setOptions([]);
      return;
    }

    setFetching(true);
    try {
      const res = await fetch(
        `/api/material-codes/search?q=${encodeURIComponent(query)}&limit=50`
      );
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || 'search failed');
      if (lastQueryRef.current !== query) return;
      setOptions(json.data || []);
    } catch (e: any) {
      console.error(e);
      message.error(`物料编码搜索失败：${e?.message || '未知错误'}`);
    } finally {
      if (lastQueryRef.current === query) setFetching(false);
    }
  };

  const debouncedFetch = useMemo(() => debounce(fetchOptions, 300), []);

  return (
    <Select
      showSearch
      allowClear
      disabled={disabled}
      placeholder={placeholder}
      value={value?.code}
      filterOption={false}
      onSearch={(q) => debouncedFetch(q)}
      notFoundContent={fetching ? <Spin size="small" /> : null}
      onChange={(code) => {
        if (!code) return onChange(null);
        const item = options.find((o) => o.code === code) || null;
        onChange(item);
      }}
      style={{ width: '100%' }}
      options={options.map((o) => ({
        value: o.code,
        label: `${o.code} ${o.name} [${o.level}]`,
      }))}
    />
  );
}

