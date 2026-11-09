import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCount, formatPct } from "@/lib/analytics/format";
import type { AnalyticsChannel } from "@/lib/gateway/schemas";

export function ChannelTable({ channels }: { channels: AnalyticsChannel[] }) {
  const total = channels.reduce((sum, channel) => sum + channel.messages, 0);
  return (
    <Table aria-label="Resumen por canal">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Canal</TableHead>
          <TableHead scope="col" className="text-right">
            Mensajes
          </TableHead>
          <TableHead scope="col" className="text-right">
            Conversaciones
          </TableHead>
          <TableHead scope="col" className="text-right">
            Proporción de mensajes
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {channels.map((channel) => (
          <TableRow key={channel.channel}>
            <TableCell className="font-medium">{channel.channelName ?? channel.channel}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCount(channel.messages)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCount(channel.conversations)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {total === 0 ? formatPct(0) : formatPct((channel.messages / total) * 100)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
