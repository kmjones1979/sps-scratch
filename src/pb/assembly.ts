namespace __proto {
  /**
   * Decoder implements protobuf message decode interface.
   *
   * Useful references:
   *
   * Protocol Buffer encoding: https://developers.google.com/protocol-buffers/docs/encoding
   * LEB128 encoding AKA varint 128 encoding: https://en.wikipedia.org/wiki/LEB128
   * ZigZag encoding/decoding (s32/s64): https://gist.github.com/mfuerstenau/ba870a29e16536fdbaba
   */
  export class Decoder {
    public view: DataView;
    public pos: i32;

    constructor(view: DataView) {
      this.view = view;
      this.pos = 0;
    }

    /**
     * Returns true if current reader has reached the buffer end
     * @returns True if current reader has reached the buffer end
     */
    @inline
    eof(): bool {
      return this.pos >= this.view.byteLength;
    }

    /**
     * Returns current buffer length in bytes
     * @returns Length in bytes
     */
    @inline
    get byteLength(): i32 {
      return this.view.byteLength;
    }

    /**
     * An alias method to fetch tag from the reader. Supposed to return tuple of [field number, wire_type].
     * TODO: Replace with return tuple when tuples become implemented in AS.
     * @returns Message tag value
     */
    @inline
    tag(): u32 {
      return this.uint32();
    }

    /**
     * Returns byte at offset, alias for getUint8
     * @param byteOffset Offset
     * @returns u8
     */
    @inline
    private u8at(byteOffset: i32): u8 {
      return this.view.getUint8(byteOffset);
    }

    /**
     * Reads and returns varint number (128 + 10 bits max) from a current position.
     * @returns Returns varint
     */
    varint(): u64 {
      let value: u64;

      // u32
      value = (u64(u8(this.u8at(this.pos))) & 127) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 7)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 14)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 21)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      // u32 remainder or u64 byte
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 28)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      // u64
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 35)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value =
        (value | ((u64(u8(this.u8at(this.pos))) & 127) << 42)) /* 42!!! */ >>>
        0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 49)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 28)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;
      // u64 remainder
      value = (value | ((u64(u8(this.u8at(this.pos))) & 127) << 35)) >>> 0;
      if (u8(this.u8at(this.pos++)) < 128) return value;

      if (this.pos > this.byteLength) {
        this.throwOutOfRange();
      }

      return value;
    }

    @inline
    int32(): i32 {
      return i32(this.varint());
    }

    @inline
    int64(): i64 {
      return i32(this.varint());
    }

    @inline
    uint32(): u32 {
      return u32(this.varint());
    }

    @inline
    uint64(): u64 {
      return u64(this.varint());
    }

    @inline
    sint32(): i32 {
      const n: u64 = this.varint();
      return i32((n >>> 1) ^ -(n & 1));
    }

    @inline
    sint64(): i64 {
      const n: u64 = this.varint();
      return i64((n >>> 1) ^ -(n & 1));
    }

    fixed32(): u32 {
      this.pos += 4;
      if (this.pos > this.byteLength) {
        this.throwOutOfRange();
      }

      // u32(u8) ensures that u8(-1) becomes u32(4294967295) instead of u8(255)
      return (
        u32(u8(this.u8at(this.pos - 4))) |
        (u32(u8(this.u8at(this.pos - 3))) << 8) |
        (u32(u8(this.u8at(this.pos - 2))) << 16) |
        (u32(u8(this.u8at(this.pos - 1))) << 24)
      );
    }

    @inline
    sfixed32(): i32 {
      return i32(this.fixed32());
    }

    fixed64(): u64 {
      this.pos += 8;
      if (this.pos > this.byteLength) {
        this.throwOutOfRange();
      }

      return (
        u64(u8(this.u8at(this.pos - 8))) |
        (u64(u8(this.u8at(this.pos - 7))) << 8) |
        (u64(u8(this.u8at(this.pos - 6))) << 16) |
        (u64(u8(this.u8at(this.pos - 5))) << 24) |
        (u64(u8(this.u8at(this.pos - 4))) << 32) |
        (u64(u8(this.u8at(this.pos - 3))) << 40) |
        (u64(u8(this.u8at(this.pos - 2))) << 48) |
        (u64(u8(this.u8at(this.pos - 1))) << 56)
      );
    }

    @inline
    sfixed64(): i64 {
      return i64(this.fixed64());
    }

    @inline
    float(): f32 {
      return f32.reinterpret_i32(this.fixed32());
    }

    @inline
    double(): f64 {
      return f64.reinterpret_i64(this.fixed64());
    }

    @inline
    bool(): boolean {
      return this.uint32() > 0;
    }

    /**
     * Reads and returns UTF8 string.
     * @returns String
     */
    string(): string {
      const length = this.uint32();
      if (this.pos + length > this.byteLength) {
        this.throwOutOfRange();
      }

      const p = this.pos + this.view.byteOffset;
      const value = String.UTF8.decode(this.view.buffer.slice(p, p + length));
      this.pos += length;
      return value;
    }

    /**
     * Reads and returns bytes array.
     * @returns Array<u8> of bytes
     */
    bytes(): Array<u8> {
      const len = this.uint32();
      if (this.pos + len > this.byteLength) {
        this.throwOutOfRange();
      }

      const a = new Array<u8>(len);
      for (let i: u32 = 0; i < len; i++) {
        a[i] = u8(this.u8at(this.pos++));
      }

      return a;
    }

    /**
     * Skips a message field if it can'be recognized by an object's decode() method
     * @param wireType Current wire type
     */
    skipType(wireType: u32): void {
      switch (wireType) {
        // int32, int64, uint32, uint64, sint32, sint64, bool, enum: varint, variable length
        case 0:
          this.varint(); // Just read a varint
          break;
        // fixed64, sfixed64, double: 8 bytes always
        case 1:
          this.skip(8);
          break;
        // length-delimited; length is determined by varint32; skip length bytes;
        case 2:
          this.skip(this.uint32());
          break;
        // tart group: skip till the end of the group, then skip group end marker
        case 3:
          while ((wireType = this.uint32() & 7) !== 4) {
            this.skipType(wireType);
          }
          break;
        // fixed32, sfixed32, float: 4 bytes always
        case 5:
          this.skip(4);
          break;

        // Something went beyond our capability to understand
        default:
          throw new Error(
            `Invalid wire type ${wireType} at offset ${this.pos}`
          );
      }
    }

    /**
     * Fast-forwards cursor by length with boundary check
     * @param length Byte length
     */
    skip(length: u32): void {
      if (this.pos + length > this.byteLength) {
        this.throwOutOfRange();
      }
      this.pos += length;
    }

    /**
     * OutOfRange check. Throws an exception if current position exceeds current buffer range
     */
    @inline
    private throwOutOfRange(): void {
      throw new Error(`Decoder position ${this.pos} is out of range!`);
    }
  }

  /**
   * Encoder implements protobuf message encode interface. This is the simplest not very effective version, which uses
   * Array<u8>.
   *
   * Useful references:
   *
   * Protocol Buffer encoding: https://developers.google.com/protocol-buffers/docs/encoding
   * LEB128 encoding AKA varint 128 encoding: https://en.wikipedia.org/wiki/LEB128
   * ZigZag encoding/decoding (s32/s64): https://gist.github.com/mfuerstenau/ba870a29e16536fdbaba
   */
  export class Encoder {
    public buf: Array<u8>;

    constructor(buf: Array<u8>) {
      this.buf = buf;
    }

    /**
     * Encodes varint at a current position
     * @returns Returns varint
     */
    varint64(value: u64): void {
      let v: u64 = value;

      while (v > 127) {
        this.buf.push(u8((v & 127) | 128));
        v = v >> 7;
      }

      this.buf.push(u8(v));
    }

    @inline
    int32(value: i32): void {
      this.varint64(value);
    }

    @inline
    int64(value: i64): void {
      this.varint64(value);
    }

    @inline
    uint32(value: u32): void {
      this.varint64(value);
    }

    @inline
    uint64(value: u64): void {
      this.varint64(value);
    }

    @inline
    sint32(value: i32): void {
      this.varint64((value << 1) ^ (value >> 31));
    }

    @inline
    sint64(value: i64): void {
      this.varint64((value << 1) ^ (value >> 63));
    }

    @inline
    fixed32(value: u32): void {
      this.buf.push(u8(value & 255));
      this.buf.push(u8((value >> 8) & 255));
      this.buf.push(u8((value >> 16) & 255));
      this.buf.push(u8(value >> 24));
    }

    @inline
    sfixed32(value: i32): void {
      this.fixed32(u32(value));
    }

    @inline
    fixed64(value: u64): void {
      this.buf.push(u8(value & 255));
      this.buf.push(u8((value >> 8) & 255));
      this.buf.push(u8((value >> 16) & 255));
      this.buf.push(u8((value >> 24) & 255));
      this.buf.push(u8((value >> 32) & 255));
      this.buf.push(u8((value >> 40) & 255));
      this.buf.push(u8((value >> 48) & 255));
      this.buf.push(u8(value >> 56));
    }

    @inline
    sfixed64(value: i64): void {
      this.fixed64(u64(value));
    }

    @inline
    float(value: f32): void {
      this.fixed32(u32(i32.reinterpret_f32(value)));
    }

    @inline
    double(value: f64): void {
      this.fixed64(u64(i64.reinterpret_f64(value)));
    }

    @inline
    bool(value: boolean): void {
      this.buf.push(value ? 1 : 0);
    }

    string(value: string): void {
      const utf8string = new DataView(String.UTF8.encode(value));

      for (let i = 0; i < utf8string.byteLength; i++) {
        this.buf.push(utf8string.getUint8(i));
      }
    }

    @inline
    bytes(value: Array<u8>): void {
      for (let i = 0; i < value.length; i++) {
        this.buf.push(value[i]);
      }
    }
  }

  /**
   * Returns byte size required to encode a value of a certain type
   */
  export class Sizer {
    static varint64(value: u64): u32 {
      return value < 128
        ? 1 // 2^7
        : value < 16384
        ? 2 // 2^14
        : value < 2097152
        ? 3 // 2^21
        : value < 268435456
        ? 4 // 2^28
        : value < 34359738368
        ? 5 // 2^35
        : value < 4398046511104
        ? 6 // 2^42
        : value < 562949953421312
        ? 7 // 2^49
        : value < 72057594037927936
        ? 8 // 2^56
        : value < 9223372036854775808
        ? 9 // 2^63
        : 10;
    }

    @inline
    static int32(value: i32): u32 {
      return Sizer.varint64(u64(value));
    }

    @inline
    static int64(value: i64): u32 {
      return Sizer.varint64(u64(value));
    }

    @inline
    static uint32(value: u32): u32 {
      return Sizer.varint64(value);
    }

    @inline
    static uint64(value: u64): u32 {
      return Sizer.varint64(value);
    }

    @inline
    static sint32(value: i32): u32 {
      return Sizer.varint64((value << 1) ^ (value >> 31));
    }

    @inline
    static sint64(value: i64): u32 {
      return Sizer.varint64((value << 1) ^ (value >> 63));
    }

    @inline
    static string(value: string): u32 {
      return value.length;
    }

    @inline
    static bytes(value: Array<u8>): u32 {
      return value.length;
    }
  }
}
export namespace eth {
  export namespace block_meta {
    export namespace v1 {
      export class BlockMeta {
        public number: u64;
        public hash: string = "";
        public parent_hash: string = "";

        // Decodes BlockMeta from an ArrayBuffer
        static decode(buf: ArrayBuffer): BlockMeta {
          return BlockMeta.decodeDataView(new DataView(buf));
        }

        // Decodes BlockMeta from a DataView
        static decodeDataView(view: DataView): BlockMeta {
          const decoder = new __proto.Decoder(view);
          const obj = new BlockMeta();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.number = decoder.uint64();
                break;
              }
              case 2: {
                obj.hash = decoder.string();
                break;
              }
              case 3: {
                obj.parent_hash = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BlockMeta

        public size(): u32 {
          let size: u32 = 0;

          size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);
          size +=
            this.hash.length > 0
              ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;
          size +=
            this.parent_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.parent_hash.length) +
                this.parent_hash.length
              : 0;

          return size;
        }

        // Encodes BlockMeta to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BlockMeta to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.number != 0) {
            encoder.uint32(0x8);
            encoder.uint64(this.number);
          }
          if (this.hash.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.hash.length);
            encoder.string(this.hash);
          }
          if (this.parent_hash.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.parent_hash.length);
            encoder.string(this.parent_hash);
          }

          return buf;
        } // encode BlockMeta
      } // BlockMeta
    } // v1
  } // block_meta
  export namespace v1 {
    export class BlockMeta {
      public number: u64;
      public hash: string = "";
      public parent_hash: string = "";

      // Decodes BlockMeta from an ArrayBuffer
      static decode(buf: ArrayBuffer): BlockMeta {
        return BlockMeta.decodeDataView(new DataView(buf));
      }

      // Decodes BlockMeta from a DataView
      static decodeDataView(view: DataView): BlockMeta {
        const decoder = new __proto.Decoder(view);
        const obj = new BlockMeta();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.number = decoder.uint64();
              break;
            }
            case 2: {
              obj.hash = decoder.string();
              break;
            }
            case 3: {
              obj.parent_hash = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode BlockMeta

      public size(): u32 {
        let size: u32 = 0;

        size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);
        size +=
          this.hash.length > 0
            ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
            : 0;
        size +=
          this.parent_hash.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.parent_hash.length) +
              this.parent_hash.length
            : 0;

        return size;
      }

      // Encodes BlockMeta to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes BlockMeta to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.number != 0) {
          encoder.uint32(0x8);
          encoder.uint64(this.number);
        }
        if (this.hash.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.hash.length);
          encoder.string(this.hash);
        }
        if (this.parent_hash.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.parent_hash.length);
          encoder.string(this.parent_hash);
        }

        return buf;
      } // encode BlockMeta
    } // BlockMeta
  } // v1
  export namespace event {
    export namespace v1 {
      export class Events {
        public events: Array<Event> = new Array<Event>();

        // Decodes Events from an ArrayBuffer
        static decode(buf: ArrayBuffer): Events {
          return Events.decodeDataView(new DataView(buf));
        }

        // Decodes Events from a DataView
        static decodeDataView(view: DataView): Events {
          const decoder = new __proto.Decoder(view);
          const obj = new Events();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const length = decoder.uint32();
                obj.events.push(
                  Event.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  )
                );
                decoder.skip(length);

                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Events

        public size(): u32 {
          let size: u32 = 0;

          for (let n: i32 = 0; n < this.events.length; n++) {
            const messageSize = this.events[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes Events to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Events to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          for (let n: i32 = 0; n < this.events.length; n++) {
            const messageSize = this.events[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xa);
              encoder.uint32(messageSize);
              this.events[n].encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode Events
      } // Events

      export class Event {
        public address: string = "";
        public topics: Array<string> = new Array<string>();
        public tx_hash: string = "";

        // Decodes Event from an ArrayBuffer
        static decode(buf: ArrayBuffer): Event {
          return Event.decodeDataView(new DataView(buf));
        }

        // Decodes Event from a DataView
        static decodeDataView(view: DataView): Event {
          const decoder = new __proto.Decoder(view);
          const obj = new Event();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.string();
                break;
              }
              case 2: {
                obj.topics.push(decoder.string());
                break;
              }
              case 3: {
                obj.tx_hash = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Event

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          size += __size_string_repeated(this.topics);

          size +=
            this.tx_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.tx_hash.length) +
                this.tx_hash.length
              : 0;

          return size;
        }

        // Encodes Event to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Event to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.string(this.address);
          }

          if (this.topics.length > 0) {
            for (let n: i32 = 0; n < this.topics.length; n++) {
              encoder.uint32(0x12);
              encoder.uint32(this.topics[n].length);
              encoder.string(this.topics[n]);
            }
          }

          if (this.tx_hash.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.tx_hash.length);
            encoder.string(this.tx_hash);
          }

          return buf;
        } // encode Event
      } // Event
    } // v1
  } // event
  export namespace v1 {
    export class Events {
      public events: Array<Event> = new Array<Event>();

      // Decodes Events from an ArrayBuffer
      static decode(buf: ArrayBuffer): Events {
        return Events.decodeDataView(new DataView(buf));
      }

      // Decodes Events from a DataView
      static decodeDataView(view: DataView): Events {
        const decoder = new __proto.Decoder(view);
        const obj = new Events();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              const length = decoder.uint32();
              obj.events.push(
                Event.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                )
              );
              decoder.skip(length);

              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Events

      public size(): u32 {
        let size: u32 = 0;

        for (let n: i32 = 0; n < this.events.length; n++) {
          const messageSize = this.events[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        return size;
      }

      // Encodes Events to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Events to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        for (let n: i32 = 0; n < this.events.length; n++) {
          const messageSize = this.events[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xa);
            encoder.uint32(messageSize);
            this.events[n].encodeU8Array(encoder);
          }
        }

        return buf;
      } // encode Events
    } // Events

    export class Event {
      public address: string = "";
      public topics: Array<string> = new Array<string>();
      public tx_hash: string = "";

      // Decodes Event from an ArrayBuffer
      static decode(buf: ArrayBuffer): Event {
        return Event.decodeDataView(new DataView(buf));
      }

      // Decodes Event from a DataView
      static decodeDataView(view: DataView): Event {
        const decoder = new __proto.Decoder(view);
        const obj = new Event();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.address = decoder.string();
              break;
            }
            case 2: {
              obj.topics.push(decoder.string());
              break;
            }
            case 3: {
              obj.tx_hash = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Event

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;

        size += __size_string_repeated(this.topics);

        size +=
          this.tx_hash.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.tx_hash.length) +
              this.tx_hash.length
            : 0;

        return size;
      }

      // Encodes Event to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Event to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.address.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.address.length);
          encoder.string(this.address);
        }

        if (this.topics.length > 0) {
          for (let n: i32 = 0; n < this.topics.length; n++) {
            encoder.uint32(0x12);
            encoder.uint32(this.topics[n].length);
            encoder.string(this.topics[n]);
          }
        }

        if (this.tx_hash.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.tx_hash.length);
          encoder.string(this.tx_hash);
        }

        return buf;
      } // encode Event
    } // Event
  } // v1
  export namespace transaction {
    export namespace v1 {
      export class Transactions {
        public transactions: Array<Transaction> = new Array<Transaction>();

        // Decodes Transactions from an ArrayBuffer
        static decode(buf: ArrayBuffer): Transactions {
          return Transactions.decodeDataView(new DataView(buf));
        }

        // Decodes Transactions from a DataView
        static decodeDataView(view: DataView): Transactions {
          const decoder = new __proto.Decoder(view);
          const obj = new Transactions();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const length = decoder.uint32();
                obj.transactions.push(
                  Transaction.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  )
                );
                decoder.skip(length);

                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Transactions

        public size(): u32 {
          let size: u32 = 0;

          for (let n: i32 = 0; n < this.transactions.length; n++) {
            const messageSize = this.transactions[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes Transactions to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Transactions to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          for (let n: i32 = 0; n < this.transactions.length; n++) {
            const messageSize = this.transactions[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xa);
              encoder.uint32(messageSize);
              this.transactions[n].encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode Transactions
      } // Transactions

      export class Transaction {
        public from: string = "";
        public to: string = "";
        public hash: string = "";

        // Decodes Transaction from an ArrayBuffer
        static decode(buf: ArrayBuffer): Transaction {
          return Transaction.decodeDataView(new DataView(buf));
        }

        // Decodes Transaction from a DataView
        static decodeDataView(view: DataView): Transaction {
          const decoder = new __proto.Decoder(view);
          const obj = new Transaction();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.from = decoder.string();
                break;
              }
              case 2: {
                obj.to = decoder.string();
                break;
              }
              case 3: {
                obj.hash = decoder.string();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Transaction

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.from.length > 0
              ? 1 + __proto.Sizer.varint64(this.from.length) + this.from.length
              : 0;
          size +=
            this.to.length > 0
              ? 1 + __proto.Sizer.varint64(this.to.length) + this.to.length
              : 0;
          size +=
            this.hash.length > 0
              ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;

          return size;
        }

        // Encodes Transaction to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Transaction to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.from.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.from.length);
            encoder.string(this.from);
          }
          if (this.to.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.to.length);
            encoder.string(this.to);
          }
          if (this.hash.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.hash.length);
            encoder.string(this.hash);
          }

          return buf;
        } // encode Transaction
      } // Transaction
    } // v1
  } // transaction
  export namespace v1 {
    export class Transactions {
      public transactions: Array<Transaction> = new Array<Transaction>();

      // Decodes Transactions from an ArrayBuffer
      static decode(buf: ArrayBuffer): Transactions {
        return Transactions.decodeDataView(new DataView(buf));
      }

      // Decodes Transactions from a DataView
      static decodeDataView(view: DataView): Transactions {
        const decoder = new __proto.Decoder(view);
        const obj = new Transactions();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              const length = decoder.uint32();
              obj.transactions.push(
                Transaction.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                )
              );
              decoder.skip(length);

              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Transactions

      public size(): u32 {
        let size: u32 = 0;

        for (let n: i32 = 0; n < this.transactions.length; n++) {
          const messageSize = this.transactions[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        return size;
      }

      // Encodes Transactions to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Transactions to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        for (let n: i32 = 0; n < this.transactions.length; n++) {
          const messageSize = this.transactions[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xa);
            encoder.uint32(messageSize);
            this.transactions[n].encodeU8Array(encoder);
          }
        }

        return buf;
      } // encode Transactions
    } // Transactions

    export class Transaction {
      public from: string = "";
      public to: string = "";
      public hash: string = "";

      // Decodes Transaction from an ArrayBuffer
      static decode(buf: ArrayBuffer): Transaction {
        return Transaction.decodeDataView(new DataView(buf));
      }

      // Decodes Transaction from a DataView
      static decodeDataView(view: DataView): Transaction {
        const decoder = new __proto.Decoder(view);
        const obj = new Transaction();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.from = decoder.string();
              break;
            }
            case 2: {
              obj.to = decoder.string();
              break;
            }
            case 3: {
              obj.hash = decoder.string();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Transaction

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.from.length > 0
            ? 1 + __proto.Sizer.varint64(this.from.length) + this.from.length
            : 0;
        size +=
          this.to.length > 0
            ? 1 + __proto.Sizer.varint64(this.to.length) + this.to.length
            : 0;
        size +=
          this.hash.length > 0
            ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
            : 0;

        return size;
      }

      // Encodes Transaction to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Transaction to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.from.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.from.length);
          encoder.string(this.from);
        }
        if (this.to.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.to.length);
          encoder.string(this.to);
        }
        if (this.hash.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.hash.length);
          encoder.string(this.hash);
        }

        return buf;
      } // encode Transaction
    } // Transaction
  } // v1
} // eth
export namespace example {
  export class Contracts {
    public contracts: Array<Contract> = new Array<Contract>();

    // Decodes Contracts from an ArrayBuffer
    static decode(buf: ArrayBuffer): Contracts {
      return Contracts.decodeDataView(new DataView(buf));
    }

    // Decodes Contracts from a DataView
    static decodeDataView(view: DataView): Contracts {
      const decoder = new __proto.Decoder(view);
      const obj = new Contracts();

      while (!decoder.eof()) {
        const tag = decoder.tag();
        const number = tag >>> 3;

        switch (number) {
          case 1: {
            const length = decoder.uint32();
            obj.contracts.push(
              Contract.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              )
            );
            decoder.skip(length);

            break;
          }

          default:
            decoder.skipType(tag & 7);
            break;
        }
      }
      return obj;
    } // decode Contracts

    public size(): u32 {
      let size: u32 = 0;

      for (let n: i32 = 0; n < this.contracts.length; n++) {
        const messageSize = this.contracts[n].size();

        if (messageSize > 0) {
          size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
        }
      }

      return size;
    }

    // Encodes Contracts to the ArrayBuffer
    encode(): ArrayBuffer {
      return changetype<ArrayBuffer>(
        StaticArray.fromArray<u8>(this.encodeU8Array())
      );
    }

    // Encodes Contracts to the Array<u8>
    encodeU8Array(
      encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
    ): Array<u8> {
      const buf = encoder.buf;

      for (let n: i32 = 0; n < this.contracts.length; n++) {
        const messageSize = this.contracts[n].size();

        if (messageSize > 0) {
          encoder.uint32(0xa);
          encoder.uint32(messageSize);
          this.contracts[n].encodeU8Array(encoder);
        }
      }

      return buf;
    } // encode Contracts
  } // Contracts

  export class Contract {
    public address: string = "";
    public timestamp: string = "";
    public blockNumber: u64;
    public ordinal: u64;

    // Decodes Contract from an ArrayBuffer
    static decode(buf: ArrayBuffer): Contract {
      return Contract.decodeDataView(new DataView(buf));
    }

    // Decodes Contract from a DataView
    static decodeDataView(view: DataView): Contract {
      const decoder = new __proto.Decoder(view);
      const obj = new Contract();

      while (!decoder.eof()) {
        const tag = decoder.tag();
        const number = tag >>> 3;

        switch (number) {
          case 1: {
            obj.address = decoder.string();
            break;
          }
          case 2: {
            obj.timestamp = decoder.string();
            break;
          }
          case 3: {
            obj.blockNumber = decoder.uint64();
            break;
          }
          case 4: {
            obj.ordinal = decoder.uint64();
            break;
          }

          default:
            decoder.skipType(tag & 7);
            break;
        }
      }
      return obj;
    } // decode Contract

    public size(): u32 {
      let size: u32 = 0;

      size +=
        this.address.length > 0
          ? 1 +
            __proto.Sizer.varint64(this.address.length) +
            this.address.length
          : 0;
      size +=
        this.timestamp.length > 0
          ? 1 +
            __proto.Sizer.varint64(this.timestamp.length) +
            this.timestamp.length
          : 0;
      size +=
        this.blockNumber == 0 ? 0 : 1 + __proto.Sizer.uint64(this.blockNumber);
      size += this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

      return size;
    }

    // Encodes Contract to the ArrayBuffer
    encode(): ArrayBuffer {
      return changetype<ArrayBuffer>(
        StaticArray.fromArray<u8>(this.encodeU8Array())
      );
    }

    // Encodes Contract to the Array<u8>
    encodeU8Array(
      encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
    ): Array<u8> {
      const buf = encoder.buf;

      if (this.address.length > 0) {
        encoder.uint32(0xa);
        encoder.uint32(this.address.length);
        encoder.string(this.address);
      }
      if (this.timestamp.length > 0) {
        encoder.uint32(0x12);
        encoder.uint32(this.timestamp.length);
        encoder.string(this.timestamp);
      }
      if (this.blockNumber != 0) {
        encoder.uint32(0x18);
        encoder.uint64(this.blockNumber);
      }
      if (this.ordinal != 0) {
        encoder.uint32(0x20);
        encoder.uint64(this.ordinal);
      }

      return buf;
    } // encode Contract
  } // Contract
} // example

// __size_string_repeated

function __size_string_repeated(value: Array<string>): u32 {
  let size: u32 = 0;

  for (let n: i32 = 0; n < value.length; n++) {
    size += 1 + __proto.Sizer.varint64(value[n].length) + value[n].length;
  }

  return size;
}
