export interface SalesReportMessage {
  date: string;
  totalSales: number;
  itemsSold: Array<{ sku: string; quantity: number }>;
}
