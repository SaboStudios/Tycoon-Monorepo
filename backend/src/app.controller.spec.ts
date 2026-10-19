import { Test, TestingModule } from '@nestjs/testing';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('is mapped to GET /', () => {
      const path = Reflect.getMetadata(
        PATH_METADATA,
        AppController.prototype.getHello,
      );
      const method = Reflect.getMetadata(
        METHOD_METADATA,
        AppController.prototype.getHello,
      );
      expect(path).toBe('/');
      expect(method).toBe(RequestMethod.GET);
    });

    it('is annotated for the Swagger contract', () => {
      const operation = Reflect.getMetadata(
        DECORATORS.API_OPERATION,
        AppController.prototype.getHello,
      );
      const responses = Reflect.getMetadata(
        DECORATORS.API_RESPONSE,
        AppController.prototype.getHello,
      );
      expect(operation).toBeDefined();
      expect(operation.summary).toBe('Basic health check endpoint');
      expect(responses).toBeDefined();
      expect(responses[200]).toBeDefined();
    });
  });
});
