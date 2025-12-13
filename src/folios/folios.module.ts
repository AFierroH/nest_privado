import { Module } from '@nestjs/common'
import { FoliosService } from './folios.service'
import { FoliosController } from './folios.controller'
import { PrismaService } from '../prisma.service'

@Module({
  controllers: [FoliosController],
  providers: [FoliosService, PrismaService],
  exports: [FoliosService]
})
export class FoliosModule {}
