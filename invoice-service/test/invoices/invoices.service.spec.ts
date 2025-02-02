import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { InvoiceService } from '../../src/invoice/invoice.service';
import { Invoice } from '../../src/invoice/schemas/invoice.schema';
import { CreateInvoiceDto } from '../../src/invoice/dto/create-invoice.dto';
import { FilterInvoicesDto } from '../../src/invoice/dto/filter-invoices.dto';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';

const mockInvoice = {
  customer: 'Test Customer',
  amount: 100,
  reference: 'INV001',
  date: new Date('2024-12-13T00:00:00.000Z'),
  items: [{ sku: 'ITEM001', qt: 1 }],
};

const mockInvoiceModel = function (dto) {
  return {
    ...mockInvoice,
    ...dto,
    date: new Date(dto.date),
    save: jest.fn().mockResolvedValue(mockInvoice),
  };
};

mockInvoiceModel.findOne = jest.fn().mockReturnValue({
  exec: jest.fn().mockResolvedValue(null),
});
mockInvoiceModel.findById = jest.fn().mockReturnValue({
  exec: jest.fn().mockResolvedValue(mockInvoice),
});
mockInvoiceModel.find = jest.fn().mockReturnValue({
  exec: jest.fn().mockResolvedValue([mockInvoice]),
});

const mockAmqpConnection = {
  publish: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key) => {
    switch (key) {
      case 'RABBITMQ_EXCHANGE_DAILY_SALES_REPORT':
        return 'daily_sales_report';
      default:
        return null;
    }
  }),
};

describe('InvoicesService', () => {
  let service: InvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: getModelToken(Invoice.name),
          useValue: mockInvoiceModel,
        },
        {
          provide: AmqpConnection,
          useValue: mockAmqpConnection,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
    service = module.get<InvoiceService>(InvoiceService);
  });

  it('should create an invoice', async () => {
    const createInvoiceDto: CreateInvoiceDto = {
      customer: 'Test Customer',
      amount: 100,
      reference: 'INV001',
      date: '2024-12-13T00:00:00.000Z',
      items: [{ sku: 'ITEM001', qt: 1 }],
    };

    const result = await service.create(createInvoiceDto);
    // Normalize date to ensure consistency
    const normalizedResult = {
      customer: result.customer,
      amount: result.amount,
      reference: result.reference,
      date: new Date(result.date).toISOString(),
      items: result.items,
    };
    const normalizedMockInvoice = {
      customer: mockInvoice.customer,
      amount: mockInvoice.amount,
      reference: mockInvoice.reference,
      date: new Date(mockInvoice.date).toISOString(),
      items: mockInvoice.items,
    };
    expect(normalizedResult).toEqual(normalizedMockInvoice);
  });

  it('should throw an error if invoice reference already exists', async () => {
    mockInvoiceModel.findOne = jest.fn().mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(mockInvoice),
    });

    const createInvoiceDto: CreateInvoiceDto = {
      customer: 'Test Customer',
      amount: 100,
      reference: 'INV001',
      date: '2024-12-13T00:00:00.000Z',
      items: [{ sku: 'ITEM001', qt: 1 }],
    };

    try {
      await service.create(createInvoiceDto);
    } catch (error) {
      expect(error.response).toBe('Reference code already exists');
      expect(error.status).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('should validate and throw an error for invalid data', async () => {
    const createInvoiceDto = {
      customer: '',
      amount: 'not-a-number',
      reference: '',
      date: 'invalid-date',
      items: [],
    };

    try {
      await service.create(createInvoiceDto as any);
    } catch (error) {
      expect(error.response).toBe('Failed to create invoice');
      expect(error.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    }
  });

  it('should find an invoice by id', async () => {
    const result = await service.findById('12345');
    expect(result).toEqual(mockInvoice);
  });

  it('should throw an error if invoice not found', async () => {
    mockInvoiceModel.findById = jest.fn().mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(null),
    });

    try {
      await service.findById('12345');
    } catch (error) {
      expect(error.response).toBe('Invoice not found');
      expect(error.status).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it('should find all invoices', async () => {
    const result = await service.findAll({});
    expect(result).toEqual([mockInvoice]);
  });

  it('should find invoices by date range', async () => {
    const query: FilterInvoicesDto = {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-12-31T23:59:59.999Z',
      minAmount: '',
      maxAmount: '',
    };

    const result = await service.findAll(query);
    expect(result).toEqual([mockInvoice]);
  });

  it('should find invoices by amount range', async () => {
    const query: FilterInvoicesDto = {
      startDate: '',
      endDate: '',
      minAmount: '50',
      maxAmount: '150',
    };

    const result = await service.findAll(query);
    expect(result).toEqual([mockInvoice]);
  });

  it('should handle calculateSalesSummary correctly', async () => {
    const salesSummary = await service.calculateSalesSummary();
    expect(salesSummary).toEqual({
      totalAmount: 100,
      itemSales: {
        ITEM001: { qt: 1 },
      },
    });
  });

  it('should handle cron job for sales summary', async () => {
    const spy = jest.spyOn(service, 'calculateSalesSummary').mockResolvedValue({
      totalAmount: 100,
      itemSales: {
        ITEM001: { qt: 1 },
      },
    });

    await service.handleCron();
    expect(spy).toHaveBeenCalled();
    expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
      'daily_sales_report',
      'routing.key',
      {
        totalAmount: 100,
        itemSales: {
          ITEM001: { qt: 1 },
        },
      },
    );
  });

  it('should throw an error if calculateSalesSummary fails', async () => {
    jest
      .spyOn(service, 'calculateSalesSummary')
      .mockRejectedValue(new Error('Calculation failed'));

    try {
      await service.handleCron();
    } catch (error) {
      expect(error.message).toBe('Calculation failed');
    }
  });
});
