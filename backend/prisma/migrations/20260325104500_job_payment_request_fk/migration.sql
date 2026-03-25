-- Link job_payment_transactions to rescue_requests for admin joins
ALTER TABLE "job_payment_transactions"
ADD CONSTRAINT "job_payment_transactions_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "rescue_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
