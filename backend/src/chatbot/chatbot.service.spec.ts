import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { ToolExecutorService } from './tool-executor.service';
import { CustomerProfileDefaultsService } from './customer-profile-defaults.service';

const mockPrisma = {
  chatbotConversation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
  chatbotMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  user: { findUnique: jest.fn() },
};

const mockOpenAIService = {
  streamChatCompletion: jest.fn(),
};

const mockToolExecutor = {
  execute: jest.fn(),
};

const mockProfileDefaults = {
  getDefaults: jest.fn().mockResolvedValue({}),
};

const mockConversation = {
  id: 'conv-001',
  userId: 'user-123',
  guestSessionId: null,
  userRole: 'USER',
  title: 'Test Conversation',
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
};

const userCaller = { userId: 'user-123', userRole: 'USER' as const };
const guestCaller = { guestSessionId: 'guest-session-1', userRole: 'GUEST' as const };

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OpenAIService, useValue: mockOpenAIService },
        { provide: ToolExecutorService, useValue: mockToolExecutor },
        { provide: CustomerProfileDefaultsService, useValue: mockProfileDefaults },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
    jest.clearAllMocks();
  });

  // ── createConversation ─────────────────────────────────────────────────────

  describe('createConversation', () => {
    it('creates a conversation for a logged-in USER', async () => {
      mockPrisma.chatbotConversation.create.mockResolvedValue(mockConversation);

      const result = await service.createConversation(userCaller, 'Test Conversation');

      expect(result.id).toBe('conv-001');
      expect(mockPrisma.chatbotConversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-123', userRole: 'USER' }),
        }),
      );
    });

    it('creates a conversation for a GUEST user', async () => {
      const guestConv = { ...mockConversation, id: 'guest-conv-1', userId: null, guestSessionId: 'guest-session-1', userRole: 'GUEST' };
      mockPrisma.chatbotConversation.create.mockResolvedValue(guestConv);

      const result = await service.createConversation(guestCaller);

      expect(result.guestSessionId).toBe('guest-session-1');
    });
  });

  // ── listConversations ──────────────────────────────────────────────────────

  describe('listConversations', () => {
    it('returns conversations for a USER', async () => {
      mockPrisma.chatbotConversation.findMany.mockResolvedValue([mockConversation]);

      const result = await service.listConversations(userCaller);

      expect(result).toHaveLength(1);
      expect(mockPrisma.chatbotConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-123' } }),
      );
    });

    it('returns conversations for a GUEST using guestSessionId', async () => {
      mockPrisma.chatbotConversation.findMany.mockResolvedValue([]);

      await service.listConversations(guestCaller);

      expect(mockPrisma.chatbotConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { guestSessionId: 'guest-session-1' } }),
      );
    });
  });

  // ── getConversation ────────────────────────────────────────────────────────

  describe('getConversation', () => {
    it('returns conversation with messages for owner', async () => {
      mockPrisma.chatbotConversation.findUnique.mockResolvedValue({
        ...mockConversation,
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
      });

      const result = await service.getConversation(userCaller, 'conv-001');

      expect(result.messages).toHaveLength(1);
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      mockPrisma.chatbotConversation.findUnique.mockResolvedValue(null);

      await expect(service.getConversation(userCaller, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user does not own the conversation', async () => {
      mockPrisma.chatbotConversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userId: 'other-user',
        messages: [],
      });

      await expect(service.getConversation(userCaller, 'conv-001')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── deleteConversation ─────────────────────────────────────────────────────

  describe('deleteConversation', () => {
    it('deletes the conversation and returns success', async () => {
      mockPrisma.chatbotConversation.findUnique.mockResolvedValue(mockConversation);
      mockPrisma.chatbotConversation.delete.mockResolvedValue(mockConversation);

      const result = await service.deleteConversation(userCaller, 'conv-001');

      expect(result.success).toBe(true);
      expect(mockPrisma.chatbotConversation.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      mockPrisma.chatbotConversation.findUnique.mockResolvedValue(null);

      await expect(service.deleteConversation(userCaller, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a different user attempts deletion', async () => {
      mockPrisma.chatbotConversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userId: 'other-user',
      });

      await expect(service.deleteConversation(userCaller, 'conv-001')).rejects.toThrow(ForbiddenException);
    });
  });
});
