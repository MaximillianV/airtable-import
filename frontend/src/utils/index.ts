export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

export const formatDuration = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const durationMs = end.getTime() - start.getTime();
  
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed':
      return '#22c55e'; // green
    case 'error':
      return '#ef4444'; // red
    case 'running':
    case 'starting':
    case 'fetching':
    case 'creating_table':
    case 'inserting':
      return '#3b82f6'; // blue
    default:
      return '#6b7280'; // gray
  }
};

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const parseTableNames = (input: string): string[] => {
  return input
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0);
};