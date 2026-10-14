export type OrderStatus = "Pending" | "Paid" | "Printing" | "Ready" | "Collected";

export type PrintOrder = {
  databaseId: string;
  id: string;
  customer: string;
  initials: string;
  time: string;
  fileName: string;
  pages: number;
  copies: number;
  amount: number;
  status: OrderStatus;
  accent: string;
  previewUrl?: string;
};

export type DashboardMetrics = {
  pagesPrinted: number;
  completedOrders: number;
  earnings: number;
  timeSavedMinutes: number;
  weeklyPages: number[];
  weeklyLabels: string[];
};
