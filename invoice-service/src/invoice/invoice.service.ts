import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private readonly exchangeName: string;

  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<Invoice>,
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigService,
  ) {
    this.exchangeName = this.configService.get<string>(
      'RABBITMQ_EXCHANGE_DAILY_SALES_REPORT',
    );
  }

  async create(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    try {
      const existingInvoice = await this.invoiceModel
        .findOne({ reference: createInvoiceDto.reference })
        .exec();
      if (existingInvoice) {
        throw new HttpException(
          'Reference code already exists',
          HttpStatus.BAD_REQUEST,
        );
      }

      const createdInvoice = new this.invoiceModel(createInvoiceDto);
      await createdInvoice.save();

      this.amqpConnection.publish(
        this.exchangeName,
        'invoices.created',
        createdInvoice,
      );

      return createdInvoice;
    } catch (error) {
      this.logger.error('Failed to create invoice', error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create invoice',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findById(id: string): Promise<Invoice> {
    try {
      const invoice = await this.invoiceModel.findById(id).exec();
      if (!invoice) {
        throw new HttpException('Invoice not found', HttpStatus.NOT_FOUND);
      }
      return invoice;
    } catch (error) {
      this.logger.error('Failed to find invoice', error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to find invoice',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(query: FilterInvoicesDto): Promise<Invoice[]> {
    try {
      const filter: any = {};

      // Filter by date range
      if (query.startDate || query.endDate) {
        filter['date'] = {};
        if (query.startDate) {
          filter['date']['$gte'] = new Date(query.startDate);
        }
        if (query.endDate) {
          filter['date']['$lte'] = new Date(query.endDate);
        }
      }

      // Filter by amount range
      if (query.minAmount || query.maxAmount) {
        filter['amount'] = {};
        if (query.minAmount) {
          filter['amount']['$gte'] = query.minAmount;
        }
        if (query.maxAmount) {
          filter['amount']['$lte'] = query.maxAmount;
        }
      }

      return await this.invoiceModel.find(filter).exec();
    } catch (error) {
      this.logger.error('Failed to find invoices', error.stack);
      throw new HttpException(
        'Failed to find invoices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleCron() {
    try {
      const salesSummary = await this.calculateSalesSummary();
      this.amqpConnection.publish(
        this.exchangeName,
        'routing.key',
        salesSummary,
      );
    } catch (error) {
      this.logger.error('Error in handleCron:', error.stack);
    }
  }

  async calculateSalesSummary() {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const invoices = await this.invoiceModel
        .find({
          date: { $gte: start, $lte: end },
        })
        .exec();

      let totalAmount = 0;
      const itemSales = {};

      invoices.forEach((invoice) => {
        totalAmount += invoice.amount;
        invoice.items.forEach((item) => {
          if (!itemSales[item.sku]) {
            itemSales[item.sku] = { qt: 0 };
          }
          itemSales[item.sku].qt += item.qt;
        });
      });

      return {
        totalAmount,
        itemSales,
      };
    } catch (error) {
      this.logger.error('Error in calculateSalesSummary:', error.stack);
      throw new HttpException(
        'Failed to calculate sales summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
