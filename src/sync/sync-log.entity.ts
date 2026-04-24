import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  employeeExternalId: string;

  @Column()
  locationExternalId: string;

  @Column()
  leaveTypeCode: string;

  @Column('decimal', { precision: 10, scale: 2 })
  localAvailable: number;

  @Column('decimal', { precision: 10, scale: 2 })
  localUsed: number;

  @Column('decimal', { precision: 10, scale: 2 })
  hcmAvailable: number;

  @Column('decimal', { precision: 10, scale: 2 })
  hcmUsed: number;

  @Column()
  action: string;

  @Column({ nullable: true })
  details: string;

  @CreateDateColumn()
  timestamp: Date;
}
