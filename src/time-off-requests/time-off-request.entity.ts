import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Location } from '../locations/location.entity';
import { LeaveType } from '../leave-types/leave-type.entity';
import { RequestStatus } from './enums/request-status.enum';

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employee, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column()
  employeeId: number;

  @ManyToOne(() => Location, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column()
  locationId: number;

  @ManyToOne(() => LeaveType, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leaveTypeId' })
  leaveType: LeaveType;

  @Column()
  leaveTypeId: number;

  @Column('date')
  startDate: string;

  @Column('date')
  endDate: string;

  @Column('decimal', { precision: 10, scale: 2 })
  days: number;

  @Column({
    type: 'varchar',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  managerNotes: string;

  /** Reference ID returned by HCM after successful submission */
  @Column({ nullable: true })
  hcmReferenceId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
