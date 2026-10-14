import type { PrintOrder } from "@/types/order";

type MockPrintOrder = Omit<PrintOrder, "databaseId"> & { databaseId?: string; collectionCode: string };

export const mockOrders: MockPrintOrder[] = [
  { id: "PF-2482", customer: "Meera Iyer", initials: "MI", time: "Just now", fileName: "Chemistry_Lab_Report.pdf", pages: 6, copies: 1, amount: 18, status: "Pending", collectionCode: "918 452", accent: "lavender" },
  { id: "PF-2481", customer: "Sahej Grover", initials: "SG", time: "2 mins ago", fileName: "Research_Paper_Final.pdf", pages: 11, copies: 1, amount: 33, status: "Paid", collectionCode: "482 916", accent: "sage" },
  { id: "PF-2480", customer: "Sid Rai", initials: "SR", time: "5 mins ago", fileName: "Lecture_Notes_Week_04.pdf", pages: 14, copies: 2, amount: 84, status: "Paid", collectionCode: "305 741", accent: "blue" },
  { id: "PF-2479", customer: "Ananya Mehta", initials: "AM", time: "12 mins ago", fileName: "Economics_Assignment.pdf", pages: 8, copies: 1, amount: 24, status: "Printing", collectionCode: "771 204", accent: "peach" },
  { id: "PF-2478", customer: "Rohan Kapoor", initials: "RK", time: "18 mins ago", fileName: "Studio_Brief_v3.pdf", pages: 26, copies: 1, amount: 78, status: "Ready", collectionCode: "196 338", accent: "lavender" },
];

export const mockAnalytics = {
  pagesPrinted: 264,
  completedOrders: 121,
  earnings: 1244,
  timeSavedMinutes: 28,
  timeSavedSeconds: 16,
  weeklyPages: [34, 48, 39, 67, 51, 82, 62],
};
