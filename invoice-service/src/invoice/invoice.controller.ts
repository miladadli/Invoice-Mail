import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { Invoice } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoicesService: InvoiceService) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return await this.invoicesService.create(createInvoiceDto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.invoicesService.findById(id);
  }

  @Get()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async findAll(@Query() query: FilterInvoicesDto): Promise<Invoice[]> {
    return this.invoicesService.findAll(query);
  }
}
