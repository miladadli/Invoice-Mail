# InvoiceMail

This project includes the `InvoiceService` and `EmailService`. The services can be easily set up and run using Docker Compose.

## Setup Instructions

### Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

## How to Run the Services

### Build and Start the Services

1. Navigate to the `InvoiceMail` folder in your terminal:

```bash
cd path/to/InvoiceMail
docker compose up --build
```

## Additional Notes on the Implementation
### Mocked Email Sending
The EmailService includes a mocked email sending function for simplicity. Instead of sending actual emails, it prints the email details to the console.

## API Endpoints
POST /invoices: Create a new invoice.

GET /invoices/:id: Retrieve an invoice by ID.

GET /invoices: Retrieve all invoices or filter by query parameters (e.g., date range, amount range).

## Logging
Request and response logging is implemented to provide visibility into the operations of the services.