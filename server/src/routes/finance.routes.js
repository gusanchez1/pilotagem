import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS as P } from '../config/permissions.js';
import {
  downloadReceipt,
  getFinanceSummary,
  getSale,
  listCategories,
  listExpenses,
  listInstallments,
  listSales,
  patchCategory,
  patchExpense,
  patchPayment,
  patchSale,
  postCategory,
  postExpense,
  postExpenseCancel,
  postExpensePay,
  postInstallmentReceive,
  postInstallmentUndo,
  postPaymentReverse,
  postSale,
  postSaleCancel,
  postSalePayment,
  uploadReceipt,
} from '../controllers/finance.controller.js';
import { permit } from '../middlewares/auth.js';
import { receiptUpload } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { idParams, objectId, periodQuery } from '../validators/common.js';
import {
  categorySchema,
  categoryUpdateSchema,
  expenseCreateSchema,
  expenseListQuery,
  expensePaySchema,
  expenseUpdateSchema,
  installmentListQuery,
  paymentSchema,
  paymentUpdateSchema,
  reasonSchema,
  receiveSchema,
  saleCreateSchema,
  saleListQuery,
  saleUpdateSchema,
} from '../validators/schemas.js';

/** Financeiro: vendas, pagamentos, parcelas, despesas, categorias e indicadores. */
const router = Router();

router.get('/finance/summary', permit(P.FINANCE_VIEW), validate({ query: periodQuery }), getFinanceSummary);

/* Vendas */
router.get('/sales', permit(P.SALES_VIEW), validate({ query: saleListQuery }), listSales);
router.post('/sales', permit(P.SALES_MANAGE), validate({ body: saleCreateSchema }), postSale);
router.get('/sales/:id', permit(P.SALES_VIEW), validate({ params: idParams }), getSale);
router.patch('/sales/:id', permit(P.SALES_MANAGE), validate({ params: idParams, body: saleUpdateSchema }), patchSale);
router.post('/sales/:id/cancel', permit(P.SALES_MANAGE), validate({ params: idParams, body: reasonSchema }), postSaleCancel);
router.post('/sales/:id/payments', permit(P.PAYMENTS_MANAGE), validate({ params: idParams, body: paymentSchema }), postSalePayment);

/* Pagamentos e comprovantes */
router.patch('/payments/:id', permit(P.PAYMENTS_MANAGE), validate({ params: idParams, body: paymentUpdateSchema }), patchPayment);
router.post('/payments/:id/reverse', permit(P.PAYMENTS_MANAGE), validate({ params: idParams, body: reasonSchema }), postPaymentReverse);
router.post(
  '/payments/:id/receipts',
  permit(P.PAYMENTS_MANAGE),
  validate({ params: idParams }),
  receiptUpload.single('file'),
  uploadReceipt,
);
router.get(
  '/payments/:id/receipts/:receiptId',
  permit(P.SALES_VIEW),
  validate({ params: z.object({ id: objectId, receiptId: objectId }) }),
  downloadReceipt,
);

/* Contas a receber (parcelas) */
router.get('/installments', permit(P.FINANCE_VIEW, P.SALES_VIEW), validate({ query: installmentListQuery }), listInstallments);
router.post('/installments/:id/receive', permit(P.PAYMENTS_MANAGE), validate({ params: idParams, body: receiveSchema }), postInstallmentReceive);
router.post('/installments/:id/undo-receive', permit(P.FINANCE_VIEW), permit(P.PAYMENTS_MANAGE), validate({ params: idParams, body: reasonSchema }), postInstallmentUndo);

/* Despesas */
router.get('/expenses', permit(P.EXPENSES_VIEW), validate({ query: expenseListQuery }), listExpenses);
router.post('/expenses', permit(P.EXPENSES_MANAGE), validate({ body: expenseCreateSchema }), postExpense);
router.patch('/expenses/:id', permit(P.EXPENSES_MANAGE), validate({ params: idParams, body: expenseUpdateSchema }), patchExpense);
router.post('/expenses/:id/pay', permit(P.EXPENSES_MANAGE), validate({ params: idParams, body: expensePaySchema }), postExpensePay);
router.post('/expenses/:id/cancel', permit(P.EXPENSES_MANAGE), validate({ params: idParams, body: reasonSchema }), postExpenseCancel);

/* Categorias financeiras */
router.get('/categories', permit(P.SALES_VIEW, P.EXPENSES_VIEW), listCategories);
router.post('/categories', permit(P.CATEGORIES_MANAGE), validate({ body: categorySchema }), postCategory);
router.patch('/categories/:id', permit(P.CATEGORIES_MANAGE), validate({ params: idParams, body: categoryUpdateSchema }), patchCategory);

export default router;
