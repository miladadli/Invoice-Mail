import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../src/email/email.service';
import { SalesReportMessage } from '../../src/interfaces/sales-report-message.interface';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'EMAIL_TO':
                  return 'recipient@example.com';
                case 'EMAIL_FROM':
                  return 'sender@example.com';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
  });

  it('should handle sales report and send email', async () => {
    const message: SalesReportMessage = {
      date: '2023-12-01',
      totalSales: 1000,
      itemsSold: [
        { sku: 'ITEM001', quantity: 10 },
        { sku: 'ITEM002', quantity: 5 },
      ],
    };

    const mockSendEmailSpy = jest
      .spyOn(emailService, 'mockSendEmail')
      .mockResolvedValueOnce();

    await emailService.handleSalesReport(message);

    expect(mockSendEmailSpy).toHaveBeenCalledWith({
      to: 'recipient@example.com',
      from: 'sender@example.com',
      subject: 'Daily Sales Report',
      text: expect.any(String),
      html: expect.any(String),
    });
  });

  it('should prepare email data correctly', () => {
    const message: SalesReportMessage = {
      date: '2023-12-01',
      totalSales: 1000,
      itemsSold: [
        { sku: 'ITEM001', quantity: 10 },
        { sku: 'ITEM002', quantity: 5 },
      ],
    };

    const emailData = emailService.prepareEmailData(message);

    expect(emailData).toEqual({
      to: 'recipient@example.com',
      from: 'sender@example.com',
      subject: 'Daily Sales Report',
      text: `Here is your daily sales report:\n\n${JSON.stringify(message, null, 2)}`,
      html: `<p>Here is your daily sales report:</p><pre>${JSON.stringify(message, null, 2)}</pre>`,
    });
  });

  it('should mock send email and log data to console', async () => {
    const emailData = {
      to: 'recipient@example.com',
      from: 'sender@example.com',
      subject: 'Daily Sales Report',
      text: 'Mock text',
      html: '<p>Mock HTML</p>',
    };

    const consoleLogSpy = jest.spyOn(console, 'log');

    await emailService.mockSendEmail(emailData);

    expect(consoleLogSpy).toHaveBeenCalledWith('Email mock send:');
    expect(consoleLogSpy).toHaveBeenCalledWith(`To: ${emailData.to}`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`From: ${emailData.from}`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`Subject: ${emailData.subject}`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`Text: ${emailData.text}`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`HTML: ${emailData.html}`);
  });
});
