import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestStatus } from './enums/request-status.enum';

@Entity('request_status_history')
export class RequestStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TimeOffRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: TimeOffRequest;

  @Column()
  requestId: number;

  @Column({ type: 'varchar', nullable: true })
  fromStatus: RequestStatus | null;

  @Column({ type: 'varchar' })
  toStatus: RequestStatus;

  @Column({ nullable: true })
  changedBy: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  timestamp: Date;
}
