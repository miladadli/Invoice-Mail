import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MongooseModule } from '@nestjs/mongoose';
import { getModelToken } from '@nestjs/mongoose';
import {
  Invoice,
  InvoiceSchema,
} from '../../src/invoice/schemas/invoice.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

describe('InvoicesController (e2e)', () => {
  let app: INestApplication;
  let invoiceModel: any;
  const testPrefix = 'TEST-';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        MongooseModule.forRootAsync({
          useFactory: async (configService: ConfigService) => ({
            uri: configService.get<string>('MONGO_URI'),
          }),
          inject: [ConfigService],
        }),
        MongooseModule.forFeature([
          { name: Invoice.name, schema: InvoiceSchema },
        ]),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    invoiceModel = app.get(getModelToken(Invoice.name));
    await app.init();
  });

  afterAll(async () => {
    await invoiceModel.deleteMany({ reference: new RegExp(`^${testPrefix}`) });
    await app.close();
  });

  it('/invoices (POST) - should create an invoice', async () => {
    const createInvoiceDto = {
      customer: 'John Doe',
      amount: 150.75,
      reference: `${testPrefix}INV-${uuidv4()}`,
      date: '2024-12-13T00:00:00.000Z',
      items: [
        { sku: 'ITEM001', qt: 2 },
        { sku: 'ITEM002', qt: 1 },
      ],
    };

    return request(app.getHttpServer())
      .post('/invoices')
      .send(createInvoiceDto)
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject(createInvoiceDto);
      });
  });

  it('/invoices (POST) - should fail to create an invoice with duplicate reference', async () => {
    const reference = `${testPrefix}INV-${uuidv4()}`;
    const createInvoiceDto = {
      customer: 'John Doe',
      amount: 150.75,
      reference: reference,
      date: '2024-12-13T00:00:00.000Z',
      items: [
        { sku: 'ITEM001', qt: 2 },
        { sku: 'ITEM002', qt: 1 },
      ],
    };

    await request(app.getHttpServer())
      .post('/invoices')
      .send(createInvoiceDto)
      .expect(201);

    return request(app.getHttpServer())
      .post('/invoices')
      .send(createInvoiceDto)
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('Reference code already exists');
      });
  });

  it('/invoices (POST) - should fail to create an invoice with invalid data', async () => {
    const createInvoiceDto = {
      customer: '',
      amount: 'not-a-number',
      reference: `${testPrefix}INV-${uuidv4()}`,
      date: 'invalid-date',
      items: [],
    };

    return request(app.getHttpServer())
      .post('/invoices')
      .send(createInvoiceDto)
      .expect(400);
  });

  it('/invoices/:id (GET) - should return an invoice by id', async () => {
    const invoice = await invoiceModel.create({
      customer: 'John Doe',
      amount: 150.75,
      reference: `${testPrefix}INV-${uuidv4()}`,
      date: new Date('2024-12-13T00:00:00.000Z'),
      items: [
        { sku: 'ITEM001', qt: 2 },
        { sku: 'ITEM002', qt: 1 },
      ],
    });

    return request(app.getHttpServer())
      .get(`/invoices/${invoice._id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          customer: 'John Doe',
          amount: 150.75,
          reference: invoice.reference,
          date: '2024-12-13T00:00:00.000Z',
          items: [
            { sku: 'ITEM001', qt: 2 },
            { sku: 'ITEM002', qt: 1 },
          ],
        });
      });
  });

  it('/invoices/:id (GET) - should return 404 if invoice not found', async () => {
    return request(app.getHttpServer())
      .get('/invoices/675bbfb4501591a41575fcc3')
      .expect(404)
      .expect((res) => {
        expect(res.body.message).toBe('Invoice not found');
      });
  });

  it('/invoices (GET) - should return all invoices', async () => {
    await invoiceModel.create([
      {
        customer: 'John Doe',
        amount: 150.75,
        reference: `${testPrefix}INV-${uuidv4()}`,
        date: new Date('2024-12-13T00:00:00.000Z'),
        items: [
          { sku: 'ITEM001', qt: 2 },
          { sku: 'ITEM002', qt: 1 },
        ],
      },
      {
        customer: 'Jane Doe',
        amount: 200.5,
        reference: `${testPrefix}INV-${uuidv4()}`,
        date: new Date('2024-12-14T00:00:00.000Z'),
        items: [
          { sku: 'ITEM003', qt: 3 },
          { sku: 'ITEM004', qt: 4 },
        ],
      },
    ]);

    return request(app.getHttpServer())
      .get('/invoices')
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBeGreaterThan(0);
      });
  });

  it('/invoices (GET) - should filter invoices by date range', async () => {
    await invoiceModel.create([
      {
        customer: 'John Doe',
        amount: 150.75,
        reference: `${testPrefix}INV-${uuidv4()}`,
        date: new Date('2024-01-01T00:00:00.000Z'),
        items: [
          { sku: 'ITEM001', qt: 2 },
          { sku: 'ITEM002', qt: 1 },
        ],
      },
      {
        customer: 'Jane Doe',
        amount: 200.5,
        reference: `${testPrefix}INV-${uuidv4()}`,
        date: new Date('2024-02-01T00:00:00.000Z'),
        items: [
          { sku: 'ITEM003', qt: 3 },
          { sku: 'ITEM004', qt: 4 },
        ],
      },
    ]);

    return request(app.getHttpServer())
      .get('/invoices')
      .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(1);
      });
  });

  it('/invoices (GET) - should filter invoices by amount range', async () => {
    await invoiceModel.create([
      {
        customer: 'John Doe',
        amount: 1500.75,
        reference: `${testPrefix}INV-${uuidv4()}`,
        date: new Date('2024-01-01T00:00:00.000Z'),
        items: [
          { sku: 'ITEM001', qt: 2 },
          { sku: 'ITEM002', qt: 1 },
        ],
      },
      {
        customer: 'Jane Doe',
        amount: 2000.5,
        reference: `${testPrefix}INV-${uuidv4()}`,
        date: new Date('2024-02-01T00:00:00.000Z'),
        items: [
          { sku: 'ITEM003', qt: 3 },
          { sku: 'ITEM004', qt: 4 },
        ],
      },
    ]);

    return request(app.getHttpServer())
      .get('/invoices')
      .query({ minAmount: '1000', maxAmount: '1600' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(1);
      });
  });

  it('/invoices (GET) - should return 400 for invalid query parameters', async () => {
    return request(app.getHttpServer())
      .get('/invoices')
      .query({ startDate: 'invalid-date' })
      .expect(400);
  });
});
