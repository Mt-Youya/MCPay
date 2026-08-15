# Use a Payment Required handshake with Monad settlement

Paid Provider calls use a 402-style request-payment-retry flow: the Agent requests a Service, receives a machine-readable Payment Request, evaluates the Offer against its Budget and selection policy, settles the Payment on Monad, and retries with proof of payment. This makes payment part of the service protocol rather than a detached checkout flow, and Monad is used as the settlement network because the product targets frequent, low-value machine-to-machine transactions.
