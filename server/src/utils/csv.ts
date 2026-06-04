export function jsonToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const keys = Object.keys(data[0]);
  const header = keys.join(',');

  const rows = data.map(row =>
    keys.map(k => {
      const val = row[k];
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','),
  );

  return [header, ...rows].join('\n');
}

export function sendCsv(res: import('express').Response, filename: string, data: Record<string, unknown>[]): void {
  const csv = jsonToCsv(data);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(csv);
}
