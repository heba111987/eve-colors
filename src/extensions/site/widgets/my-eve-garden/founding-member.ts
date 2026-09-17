import { checkout, orders } from '@wix/site-pricing-plans';

export const FOUNDING_MEMBER_PLAN_ID = '960d8cff-583d-4d75-8419-d6a0c3c26478';

export const hasFoundingMemberAccess = async (): Promise<boolean> => {
  const memberOrders = await orders.listCurrentMemberOrders();
  return memberOrders.some((order) => (
    order.planId === FOUNDING_MEMBER_PLAN_ID
    && order.status === 'ACTIVE'
  ));
};

export const purchaseFoundingMemberAccess = async (): Promise<void> => {
  await checkout.startOnlinePurchase(FOUNDING_MEMBER_PLAN_ID);
};
