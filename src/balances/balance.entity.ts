import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Unique,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Location } from '../locations/location.entity';
import { LeaveType } from '../leave-types/leave-type.entity';

@Entity('balances')
@Unique(['employee', 'location', 'leaveType'])
export class Balance {
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

  /** Total days available (from HCM) */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  available: number;

  /** Days already used/confirmed */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  used: number;

  /** Days in pending/approved requests (not yet confirmed by HCM) */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  pending: number;

  @Column({ nullable: true })
  lastSyncedAt: Date;

  /** Optimistic locking to prevent race conditions */
  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Computed: available - used - pending */
  get effectiveBalance(): number {
    return Number(this.available) - Number(this.used) - Number(this.pending);
  }
}
