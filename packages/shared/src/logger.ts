export class Logger {
  static scrub(message: string): string {
    return message
      .replace(/\b[\w.-]+@[\w.-]+\.\w{2,4}\b/g, '[REDACTED EMAIL]')
      .replace(/\+?[0-9\s-]{10,15}\b/g, '[REDACTED PHONE]');
  }

  static log(message: string, context?: any) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: this.scrub(message),
      ...context
    };
    console.log(JSON.stringify(logObject));
  }
}
