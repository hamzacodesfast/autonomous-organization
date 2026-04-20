export type LocalAllocation = {
  size: string;
  quantity: number;
};

export type PublicLocal = {
  number: string;
  name: string;
  concept: string;
  issueDate: string;
  status: string;
  price: string;
  editionCount: number;
  remainingCount: number;
  garment: string;
  graphic: string;
  specifications: string;
  frontMockup: string;
  backMockup: string;
  allocation: LocalAllocation[];
  shipping: string;
};

export type PublicDashboardSnapshot = {
  currentLocal: string;
  localStatus: string;
  lastAgentAction: string;
  uptime: string;
  fulfilledThisMonth: number;
};

export const local001: PublicLocal = {
  number: "001",
  name: "LOCAL NO. 001 TEE",
  concept: "Local No. 001: founding artifact.",
  issueDate: "N/A",
  status: "pending approval",
  price: "$50 USD",
  editionCount: 100,
  remainingCount: 100,
  garment: "Black Gildan 5000 short-sleeve tee.",
  graphic: "Primary Organization mark printed on the back.",
  specifications: "Sizes S-XXL. 100 units total.",
  frontMockup: "/mockups/GILDAN5000_FRONT.png",
  backMockup: "/mockups/PRINTIFY_GILDAN5000_BACK.png",
  allocation: [
    { size: "S", quantity: 20 },
    { size: "M", quantity: 20 },
    { size: "L", quantity: 20 },
    { size: "XL", quantity: 20 },
    { size: "XXL", quantity: 20 },
  ],
  shipping: "Shipping included for countries available at checkout.",
};

export const dashboardSnapshot: PublicDashboardSnapshot = {
  currentLocal: "001",
  localStatus: "pending approval",
  lastAgentAction: "2026-04-19T23:30:00Z token freeze approval recorded",
  uptime: "pre-launch",
  fulfilledThisMonth: 0,
};
