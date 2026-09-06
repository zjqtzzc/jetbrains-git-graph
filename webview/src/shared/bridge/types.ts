import type { CommandType } from "../../../../shared/protocol";

export type {
  CommandType,
  EventMessage,
  Message,
  RequestMessage,
  ResponseMessage,
} from "../../../../shared/protocol";

export interface Bridge {
  request(
    command: CommandType | string,
    params?: Record<string, unknown>,
  ): Promise<unknown>;
  onEvent(handler: (event: string, data: unknown) => void): () => void;
}
