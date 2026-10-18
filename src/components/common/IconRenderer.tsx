import React from 'react';
import {
  CreditCard,
  ArrowRightLeft,
  ShieldAlert,
  Receipt,
  Coins,
  Building2,
  BadgeDollarSign,
  FileText,
  FileCheck,
  CalendarDays,
  CalendarClock,
  CalendarRange,
  ShieldOff,
  CheckCheck,
  Timer,
  Hash,
  Calendar,
  FileSpreadsheet,
  UserCheck,
  CopyCheck,
  Edit3,
  Clock,
  HelpCircle,
  type LucideProps
} from 'lucide-react';

interface IconRendererProps extends LucideProps {
  name: string;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ name, ...props }) => {
  switch (name) {
    case 'ClockAlert':
      return <Clock {...props} />;
    case 'CreditCard':
      return <CreditCard {...props} />;
    case 'ArrowRightLeft':
      return <ArrowRightLeft {...props} />;
    case 'ShieldAlert':
      return <ShieldAlert {...props} />;
    case 'Receipt':
      return <Receipt {...props} />;
    case 'Coins':
      return <Coins {...props} />;
    case 'Building2':
      return <Building2 {...props} />;
    case 'BadgeDollarSign':
      return <BadgeDollarSign {...props} />;
    case 'FileText':
      return <FileText {...props} />;
    case 'FileCheck':
      return <FileCheck {...props} />;
    case 'CalendarDays':
      return <CalendarDays {...props} />;
    case 'CalendarClock':
      return <CalendarClock {...props} />;
    case 'CalendarRange':
      return <CalendarRange {...props} />;
    case 'ShieldOff':
      return <ShieldOff {...props} />;
    case 'CheckCheck':
      return <CheckCheck {...props} />;
    case 'Timer':
      return <Timer {...props} />;
    case 'Hash':
      return <Hash {...props} />;
    case 'Calendar':
      return <Calendar {...props} />;
    case 'FileSpreadsheet':
      return <FileSpreadsheet {...props} />;
    case 'UserCheck':
      return <UserCheck {...props} />;
    case 'CopyCheck':
      return <CopyCheck {...props} />;
    case 'Edit3':
      return <Edit3 {...props} />;
    default:
      return <HelpCircle {...props} />;
  }
};
