import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { SalesReportMessage } from '../interfaces/sales-report-message.interface';

@Injectable()
export class EmailService {
  constructor(private readonly configService: ConfigService) {}

  @RabbitSubscribe({
    exchange: 'daily_sales_report',
    routingKey: 'routing.key',
    queue: 'daily_sales_queue',
  })
  async handleSalesReport(message: SalesReportMessage) {
    const emailData = this.prepareEmailData(message);
    await this.mockSendEmail(emailData);
  }

  prepareEmailData(message: SalesReportMessage) {
    return {
      to: this.configService.get<string>('EMAIL_TO'),
      from: this.configService.get<string>('EMAIL_FROM'),
      subject: 'Daily Sales Report',
      text: `Here is your daily sales report:\n\n${JSON.stringify(message, null, 2)}`,
      html: `<p>Here is your daily sales report:</p><pre>${JSON.stringify(message, null, 2)}</pre>`,
    };
  }

  async mockSendEmail(emailData: any) {
    // Instead of sending the email, we'll print it to the console
    console.log('Email mock send:');
    console.log(`To: ${emailData.to}`);
    console.log(`From: ${emailData.from}`);
    console.log(`Subject: ${emailData.subject}`);
    console.log(`Text: ${emailData.text}`);
    console.log(`HTML: ${emailData.html}`);
  }
}
