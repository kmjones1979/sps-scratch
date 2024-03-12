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
export namespace google {
  export namespace protobuf {
    /**
     * A Timestamp represents a point in time independent of any time zone or local
     *  calendar, encoded as a count of seconds and fractions of seconds at
     *  nanosecond resolution. The count is relative to an epoch at UTC midnight on
     *  January 1, 1970, in the proleptic Gregorian calendar which extends the
     *  Gregorian calendar backwards to year one.
     *
     *  All minutes are 60 seconds long. Leap seconds are "smeared" so that no leap
     *  second table is needed for interpretation, using a [24-hour linear
     *  smear](https://developers.google.com/time/smear).
     *
     *  The range is from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z. By
     *  restricting to that range, we ensure that we can convert to and from [RFC
     *  3339](https://www.ietf.org/rfc/rfc3339.txt) date strings.
     *
     *  # Examples
     *
     *  Example 1: Compute Timestamp from POSIX `time()`.
     *
     *      Timestamp timestamp;
     *      timestamp.set_seconds(time(NULL));
     *      timestamp.set_nanos(0);
     *
     *  Example 2: Compute Timestamp from POSIX `gettimeofday()`.
     *
     *      struct timeval tv;
     *      gettimeofday(&tv, NULL);
     *
     *      Timestamp timestamp;
     *      timestamp.set_seconds(tv.tv_sec);
     *      timestamp.set_nanos(tv.tv_usec * 1000);
     *
     *  Example 3: Compute Timestamp from Win32 `GetSystemTimeAsFileTime()`.
     *
     *      FILETIME ft;
     *      GetSystemTimeAsFileTime(&ft);
     *      UINT64 ticks = (((UINT64)ft.dwHighDateTime) << 32) | ft.dwLowDateTime;
     *
     *      // A Windows tick is 100 nanoseconds. Windows epoch 1601-01-01T00:00:00Z
     *      // is 11644473600 seconds before Unix epoch 1970-01-01T00:00:00Z.
     *      Timestamp timestamp;
     *      timestamp.set_seconds((INT64) ((ticks / 10000000) - 11644473600LL));
     *      timestamp.set_nanos((INT32) ((ticks % 10000000) * 100));
     *
     *  Example 4: Compute Timestamp from Java `System.currentTimeMillis()`.
     *
     *      long millis = System.currentTimeMillis();
     *
     *      Timestamp timestamp = Timestamp.newBuilder().setSeconds(millis / 1000)
     *          .setNanos((int) ((millis % 1000) * 1000000)).build();
     *
     *
     *  Example 5: Compute Timestamp from Java `Instant.now()`.
     *
     *      Instant now = Instant.now();
     *
     *      Timestamp timestamp =
     *          Timestamp.newBuilder().setSeconds(now.getEpochSecond())
     *              .setNanos(now.getNano()).build();
     *
     *
     *  Example 6: Compute Timestamp from current time in Python.
     *
     *      timestamp = Timestamp()
     *      timestamp.GetCurrentTime()
     *
     *  # JSON Mapping
     *
     *  In JSON format, the Timestamp type is encoded as a string in the
     *  [RFC 3339](https://www.ietf.org/rfc/rfc3339.txt) format. That is, the
     *  format is "{year}-{month}-{day}T{hour}:{min}:{sec}[.{frac_sec}]Z"
     *  where {year} is always expressed using four digits while {month}, {day},
     *  {hour}, {min}, and {sec} are zero-padded to two digits each. The fractional
     *  seconds, which can go up to 9 digits (i.e. up to 1 nanosecond resolution),
     *  are optional. The "Z" suffix indicates the timezone ("UTC"); the timezone
     *  is required. A proto3 JSON serializer should always use UTC (as indicated by
     *  "Z") when printing the Timestamp type and a proto3 JSON parser should be
     *  able to accept both UTC and other timezones (as indicated by an offset).
     *
     *  For example, "2017-01-15T01:30:15.01Z" encodes 15.01 seconds past
     *  01:30 UTC on January 15, 2017.
     *
     *  In JavaScript, one can convert a Date object to this format using the
     *  standard
     *  [toISOString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString)
     *  method. In Python, a standard `datetime.datetime` object can be converted
     *  to this format using
     *  [`strftime`](https://docs.python.org/2/library/time.html#time.strftime) with
     *  the time format spec '%Y-%m-%dT%H:%M:%S.%fZ'. Likewise, in Java, one can use
     *  the Joda Time's [`ISODateTimeFormat.dateTime()`](
     *  http://www.joda.org/joda-time/apidocs/org/joda/time/format/ISODateTimeFormat.html#dateTime%2D%2D
     *  ) to obtain a formatter capable of generating timestamps in this format.
     */
    export class Timestamp {
      /**
       * Represents seconds of UTC time since Unix epoch
       *  1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
       *  9999-12-31T23:59:59Z inclusive.
       */
      public seconds: i64;
      /**
       * Non-negative fractions of a second at nanosecond resolution. Negative
       *  second values with fractions must still have non-negative nanos values
       *  that count forward in time. Must be from 0 to 999,999,999
       *  inclusive.
       */
      public nanos: i32;

      // Decodes Timestamp from an ArrayBuffer
      static decode(buf: ArrayBuffer): Timestamp {
        return Timestamp.decodeDataView(new DataView(buf));
      }

      // Decodes Timestamp from a DataView
      static decodeDataView(view: DataView): Timestamp {
        const decoder = new __proto.Decoder(view);
        const obj = new Timestamp();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.seconds = decoder.int64();
              break;
            }
            case 2: {
              obj.nanos = decoder.int32();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Timestamp

      public size(): u32 {
        let size: u32 = 0;

        size += this.seconds == 0 ? 0 : 1 + __proto.Sizer.int64(this.seconds);
        size += this.nanos == 0 ? 0 : 1 + __proto.Sizer.int32(this.nanos);

        return size;
      }

      // Encodes Timestamp to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Timestamp to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.seconds != 0) {
          encoder.uint32(0x8);
          encoder.int64(this.seconds);
        }
        if (this.nanos != 0) {
          encoder.uint32(0x10);
          encoder.int32(this.nanos);
        }

        return buf;
      } // encode Timestamp
    } // Timestamp
  } // protobuf
} // google
export namespace sf {
  export namespace ethereum {
    export namespace type {
      export namespace v2 {
        export enum TransactionTraceStatus {
          UNKNOWN = 0,
          SUCCEEDED = 1,
          FAILED = 2,
          REVERTED = 3,
        } // TransactionTraceStatus
        export enum CallType {
          UNSPECIFIED = 0,
          // direct? what's the name for `Call` alone?
          CALL = 1,
          CALLCODE = 2,
          DELEGATE = 3,
          STATIC = 4,
          // create2 ? any other form of calls?
          CREATE = 5,
        } // CallType
        export class Block {
          // Hash is the block's hash.
          public hash: Array<u8> = new Array<u8>();
          // Number is the block's height at which this block was mined.
          public number: u64;
          /**
           * Size is the size in bytes of the RLP encoding of the block according to Ethereum
           *  rules.
           * uint64 size = 4;
           *  Header contain's the block's header information like its parent hash, the merkel root hash
           *  and all other information the form a block.
           */
          public header: BlockHeader = new BlockHeader();
          /**
           * Uncles represents block produced with a valid solution but were not actually choosen
           *  as the canonical block for the given height so they are mostly "forked" blocks.
           *
           *  If the Block has been produced using the Proof of Stake consensus algorithm, this
           *  field will actually be always empty.
           */
          public uncles: Array<BlockHeader> = new Array<BlockHeader>();
          /**
           * TransactionTraces hold the execute trace of all the transactions that were executed
           *  in this block. In in there that you will find most of the Ethereum data model.
           *
           *  They are ordered by the order of execution of the transaction in the block.
           */
          public transaction_traces: Array<TransactionTrace> =
            new Array<TransactionTrace>();
          /**
           * BalanceChanges here is the array of ETH transfer that happened at the block level
           *  outside of the normal transaction flow of a block. The best example of this is mining
           *  reward for the block mined, the transfer of ETH to the miner happens outside the normal
           *  transaction flow of the chain and is recorded as a `BalanceChange` here since we cannot
           *  attached it to any transaction.
           *
           *  Only available in DetailLevel: EXTENDED
           */
          public balance_changes: Array<BalanceChange> =
            new Array<BalanceChange>();
          /**
           * DetailLevel affects the data available in this block.
           *
           *  EXTENDED describes the most complete block, with traces, balance changes, storage changes. It is extracted during the execution of the block.
           *  BASE describes a block that contains only the block header, transaction receipts and event logs: everything that can be extracted using the base JSON-RPC interface (https://ethereum.org/en/developers/docs/apis/json-rpc/#json-rpc-methods)
           *       Furthermore, the eth_getTransactionReceipt call has been avoided because it brings only minimal improvements at the cost of requiring an archive node or a full node with complete transaction index.
           */
          public detail_level: u32;
          /**
           * CodeChanges here is the array of smart code change that happened that happened at the block level
           *  outside of the normal transaction flow of a block. Some Ethereum's fork like BSC and Polygon
           *  has some capabilities to upgrade internal smart contracts used usually to track the validator
           *  list.
           *
           *  On hard fork, some procedure runs to upgrade the smart contract code to a new version. In those
           *  network, a `CodeChange` for each modified smart contract on upgrade would be present here. Note
           *  that this happen rarely, so the vast majority of block will have an empty list here.
           *  Only available in DetailLevel: EXTENDED
           */
          public code_changes: Array<CodeChange> = new Array<CodeChange>();
          /**
           * System calls are introduced in Cancun, along with blobs. They are executed outside of transactions but affect the state.
           *  Only available in DetailLevel: EXTENDED
           */
          public system_calls: Array<Call> = new Array<Call>();
          /**
           * Ver represents that data model version of the block, it is used internally by Firehose on Ethereum
           *  as a validation that we are reading the correct version.
           */
          public ver: i32;

          // Decodes Block from an ArrayBuffer
          static decode(buf: ArrayBuffer): Block {
            return Block.decodeDataView(new DataView(buf));
          }

          // Decodes Block from a DataView
          static decodeDataView(view: DataView): Block {
            const decoder = new __proto.Decoder(view);
            const obj = new Block();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 2: {
                  obj.hash = decoder.bytes();
                  break;
                }
                case 3: {
                  obj.number = decoder.uint64();
                  break;
                }
                case 5: {
                  const length = decoder.uint32();
                  obj.header = BlockHeader.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 6: {
                  const length = decoder.uint32();
                  obj.uncles.push(
                    BlockHeader.decodeDataView(
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
                case 10: {
                  const length = decoder.uint32();
                  obj.transaction_traces.push(
                    TransactionTrace.decodeDataView(
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
                case 11: {
                  const length = decoder.uint32();
                  obj.balance_changes.push(
                    BalanceChange.decodeDataView(
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
                case 12: {
                  obj.detail_level = decoder.uint32();
                  break;
                }
                case 20: {
                  const length = decoder.uint32();
                  obj.code_changes.push(
                    CodeChange.decodeDataView(
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
                case 21: {
                  const length = decoder.uint32();
                  obj.system_calls.push(
                    Call.decodeDataView(
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
                case 1: {
                  obj.ver = decoder.int32();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode Block

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.hash.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.hash.length) +
                  this.hash.length
                : 0;
            size +=
              this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);

            if (this.header != null) {
              const f: BlockHeader = this.header as BlockHeader;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.uncles.length; n++) {
              const messageSize = this.uncles[n].size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.transaction_traces.length; n++) {
              const messageSize = this.transaction_traces[n].size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.balance_changes.length; n++) {
              const messageSize = this.balance_changes[n].size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.detail_level == 0
                ? 0
                : 1 + __proto.Sizer.uint32(this.detail_level);

            for (let n: i32 = 0; n < this.code_changes.length; n++) {
              const messageSize = this.code_changes[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.system_calls.length; n++) {
              const messageSize = this.system_calls[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size += this.ver == 0 ? 0 : 1 + __proto.Sizer.int32(this.ver);

            return size;
          }

          // Encodes Block to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes Block to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.hash.length > 0) {
              encoder.uint32(0x12);
              encoder.uint32(this.hash.length);
              encoder.bytes(this.hash);
            }
            if (this.number != 0) {
              encoder.uint32(0x18);
              encoder.uint64(this.number);
            }

            if (this.header != null) {
              const f = this.header as BlockHeader;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x2a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.uncles.length; n++) {
              const messageSize = this.uncles[n].size();

              if (messageSize > 0) {
                encoder.uint32(0x32);
                encoder.uint32(messageSize);
                this.uncles[n].encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.transaction_traces.length; n++) {
              const messageSize = this.transaction_traces[n].size();

              if (messageSize > 0) {
                encoder.uint32(0x52);
                encoder.uint32(messageSize);
                this.transaction_traces[n].encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.balance_changes.length; n++) {
              const messageSize = this.balance_changes[n].size();

              if (messageSize > 0) {
                encoder.uint32(0x5a);
                encoder.uint32(messageSize);
                this.balance_changes[n].encodeU8Array(encoder);
              }
            }

            if (this.detail_level != 0) {
              encoder.uint32(0x60);
              encoder.uint32(this.detail_level);
            }

            for (let n: i32 = 0; n < this.code_changes.length; n++) {
              const messageSize = this.code_changes[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xa2);
                encoder.uint32(messageSize);
                this.code_changes[n].encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.system_calls.length; n++) {
              const messageSize = this.system_calls[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xaa);
                encoder.uint32(messageSize);
                this.system_calls[n].encodeU8Array(encoder);
              }
            }

            if (this.ver != 0) {
              encoder.uint32(0x8);
              encoder.int32(this.ver);
            }

            return buf;
          } // encode Block
        } // Block

        export enum Block_DetailLevel {
          DETAILLEVEL_EXTENDED = 0,
          // DETAILLEVEL_TRACE = 1; // TBD
          DETAILLEVEL_BASE = 2,
        } // Block_DetailLevel
        /**
         * BlockWithRefs is a lightweight block, with traces and transactions
         *  purged from the `block` within, and only.  It is used in transports
         *  to pass block data around.
         */
        export class BlockHeader {
          public parent_hash: Array<u8> = new Array<u8>();
          /**
           * Uncle hash of the block, some reference it as `sha3Uncles`, but `sha3`` is badly worded, so we prefer `uncle_hash`, also
           *  referred as `ommers` in EIP specification.
           *
           *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
           *  consensus algorithm, this field will actually be constant and set to `0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347`.
           */
          public uncle_hash: Array<u8> = new Array<u8>();
          public coinbase: Array<u8> = new Array<u8>();
          public state_root: Array<u8> = new Array<u8>();
          public transactions_root: Array<u8> = new Array<u8>();
          public receipt_root: Array<u8> = new Array<u8>();
          public logs_bloom: Array<u8> = new Array<u8>();
          /**
           * Difficulty is the difficulty of the Proof of Work algorithm that was required to compute a solution.
           *
           *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
           *  consensus algorithm, this field will actually be constant and set to `0x00`.
           */
          public difficulty: BigInt = new BigInt();
          /**
           * TotalDifficulty is the sum of all previous blocks difficulty including this block difficulty.
           *
           *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
           *  consensus algorithm, this field will actually be constant and set to the terminal total difficulty
           *  that was required to transition to Proof of Stake algorithm, which varies per network. It is set to
           *  58 750 000 000 000 000 000 000 on Ethereum Mainnet and to 10 790 000 on Ethereum Testnet Goerli.
           */
          public total_difficulty: BigInt = new BigInt();
          public number: u64;
          public gas_limit: u64;
          public gas_used: u64;
          public timestamp: google.protobuf.Timestamp =
            new google.protobuf.Timestamp();
          /**
           * ExtraData is free-form bytes included in the block by the "miner". While on Yellow paper of
           *  Ethereum this value is maxed to 32 bytes, other consensus algorithm like Clique and some other
           *  forks are using bigger values to carry special consensus data.
           *
           *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
           *  consensus algorithm, this field is strictly enforced to be <= 32 bytes.
           */
          public extra_data: Array<u8> = new Array<u8>();
          /**
           * MixHash is used to prove, when combined with the `nonce` that sufficient amount of computation has been
           *  achieved and that the solution found is valid.
           */
          public mix_hash: Array<u8> = new Array<u8>();
          /**
           * Nonce is used to prove, when combined with the `mix_hash` that sufficient amount of computation has been
           *  achieved and that the solution found is valid.
           *
           *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
           *  consensus algorithm, this field will actually be constant and set to `0`.
           */
          public nonce: u64;
          /**
           * Hash is the hash of the block which is actually the computation:
           *
           *   Keccak256(rlp([
           *     parent_hash,
           *     uncle_hash,
           *     coinbase,
           *     state_root,
           *     transactions_root,
           *     receipt_root,
           *     logs_bloom,
           *     difficulty,
           *     number,
           *     gas_limit,
           *     gas_used,
           *     timestamp,
           *     extra_data,
           *     mix_hash,
           *     nonce,
           *     base_fee_per_gas (to be included only if London fork is active)
           *     withdrawals_root (to be included only if Shangai fork is active)
           *     blob_gas_used (to be included only if Cancun fork is active)
           *     excess_blob_gas (to be included only if Cancun fork is active)
           *     parent_beacon_root (to be included only if Cancun fork is active)
           *   ]))
           */
          public hash: Array<u8> = new Array<u8>();
          // Base fee per gas according to EIP-1559 (e.g. London Fork) rules, only set if London is present/active on the chain.
          public base_fee_per_gas: BigInt = new BigInt();
          /**
           * Withdrawals root hash according to EIP-4895 (e.g. Shangai Fork) rules, only set if Shangai is present/active on the chain.
           *
           *  Only available in DetailLevel: EXTENDED
           */
          public withdrawals_root: Array<u8> = new Array<u8>();
          // Only available in DetailLevel: EXTENDED
          public tx_dependency: Uint64NestedArray = new Uint64NestedArray();
          // BlobGasUsed was added by EIP-4844 and is ignored in legacy headers.
          public blob_gas_used: u64;
          // ExcessBlobGas was added by EIP-4844 and is ignored in legacy headers.
          public excess_blob_gas: u64;
          // ParentBeaconRoot was added by EIP-4788 and is ignored in legacy headers.
          public parent_beacon_root: Array<u8> = new Array<u8>();

          public ___blob_gas_used: string = "";
          public ___blob_gas_used_index: u8 = 0;

          public ___excess_blob_gas: string = "";
          public ___excess_blob_gas_index: u8 = 0;

          static readonly BLOB_GAS_USED_BLOB_GAS_USED_INDEX: u8 = 22;
          static readonly EXCESS_BLOB_GAS_EXCESS_BLOB_GAS_INDEX: u8 = 23;

          // Decodes BlockHeader from an ArrayBuffer
          static decode(buf: ArrayBuffer): BlockHeader {
            return BlockHeader.decodeDataView(new DataView(buf));
          }

          // Decodes BlockHeader from a DataView
          static decodeDataView(view: DataView): BlockHeader {
            const decoder = new __proto.Decoder(view);
            const obj = new BlockHeader();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.parent_hash = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.uncle_hash = decoder.bytes();
                  break;
                }
                case 3: {
                  obj.coinbase = decoder.bytes();
                  break;
                }
                case 4: {
                  obj.state_root = decoder.bytes();
                  break;
                }
                case 5: {
                  obj.transactions_root = decoder.bytes();
                  break;
                }
                case 6: {
                  obj.receipt_root = decoder.bytes();
                  break;
                }
                case 7: {
                  obj.logs_bloom = decoder.bytes();
                  break;
                }
                case 8: {
                  const length = decoder.uint32();
                  obj.difficulty = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 17: {
                  const length = decoder.uint32();
                  obj.total_difficulty = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 9: {
                  obj.number = decoder.uint64();
                  break;
                }
                case 10: {
                  obj.gas_limit = decoder.uint64();
                  break;
                }
                case 11: {
                  obj.gas_used = decoder.uint64();
                  break;
                }
                case 12: {
                  const length = decoder.uint32();
                  obj.timestamp = google.protobuf.Timestamp.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 13: {
                  obj.extra_data = decoder.bytes();
                  break;
                }
                case 14: {
                  obj.mix_hash = decoder.bytes();
                  break;
                }
                case 15: {
                  obj.nonce = decoder.uint64();
                  break;
                }
                case 16: {
                  obj.hash = decoder.bytes();
                  break;
                }
                case 18: {
                  const length = decoder.uint32();
                  obj.base_fee_per_gas = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 19: {
                  obj.withdrawals_root = decoder.bytes();
                  break;
                }
                case 20: {
                  const length = decoder.uint32();
                  obj.tx_dependency = Uint64NestedArray.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 22: {
                  obj.blob_gas_used = decoder.uint64();
                  obj.___blob_gas_used = "blob_gas_used";
                  obj.___blob_gas_used_index = 22;
                  break;
                }
                case 23: {
                  obj.excess_blob_gas = decoder.uint64();
                  obj.___excess_blob_gas = "excess_blob_gas";
                  obj.___excess_blob_gas_index = 23;
                  break;
                }
                case 24: {
                  obj.parent_beacon_root = decoder.bytes();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode BlockHeader

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.parent_hash.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.parent_hash.length) +
                  this.parent_hash.length
                : 0;
            size +=
              this.uncle_hash.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.uncle_hash.length) +
                  this.uncle_hash.length
                : 0;
            size +=
              this.coinbase.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.coinbase.length) +
                  this.coinbase.length
                : 0;
            size +=
              this.state_root.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.state_root.length) +
                  this.state_root.length
                : 0;
            size +=
              this.transactions_root.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.transactions_root.length) +
                  this.transactions_root.length
                : 0;
            size +=
              this.receipt_root.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.receipt_root.length) +
                  this.receipt_root.length
                : 0;
            size +=
              this.logs_bloom.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.logs_bloom.length) +
                  this.logs_bloom.length
                : 0;

            if (this.difficulty != null) {
              const f: BigInt = this.difficulty as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            if (this.total_difficulty != null) {
              const f: BigInt = this.total_difficulty as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);
            size +=
              this.gas_limit == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.gas_limit);
            size +=
              this.gas_used == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_used);

            if (this.timestamp != null) {
              const f: google.protobuf.Timestamp = this
                .timestamp as google.protobuf.Timestamp;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.extra_data.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.extra_data.length) +
                  this.extra_data.length
                : 0;
            size +=
              this.mix_hash.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.mix_hash.length) +
                  this.mix_hash.length
                : 0;
            size += this.nonce == 0 ? 0 : 1 + __proto.Sizer.uint64(this.nonce);
            size +=
              this.hash.length > 0
                ? 2 +
                  __proto.Sizer.varint64(this.hash.length) +
                  this.hash.length
                : 0;

            if (this.base_fee_per_gas != null) {
              const f: BigInt = this.base_fee_per_gas as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.withdrawals_root.length > 0
                ? 2 +
                  __proto.Sizer.varint64(this.withdrawals_root.length) +
                  this.withdrawals_root.length
                : 0;

            if (this.tx_dependency != null) {
              const f: Uint64NestedArray = this
                .tx_dependency as Uint64NestedArray;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.blob_gas_used == 0
                ? 0
                : 2 + __proto.Sizer.uint64(this.blob_gas_used);
            size +=
              this.excess_blob_gas == 0
                ? 0
                : 2 + __proto.Sizer.uint64(this.excess_blob_gas);
            size +=
              this.parent_beacon_root.length > 0
                ? 2 +
                  __proto.Sizer.varint64(this.parent_beacon_root.length) +
                  this.parent_beacon_root.length
                : 0;

            return size;
          }

          // Encodes BlockHeader to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes BlockHeader to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.parent_hash.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.parent_hash.length);
              encoder.bytes(this.parent_hash);
            }
            if (this.uncle_hash.length > 0) {
              encoder.uint32(0x12);
              encoder.uint32(this.uncle_hash.length);
              encoder.bytes(this.uncle_hash);
            }
            if (this.coinbase.length > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(this.coinbase.length);
              encoder.bytes(this.coinbase);
            }
            if (this.state_root.length > 0) {
              encoder.uint32(0x22);
              encoder.uint32(this.state_root.length);
              encoder.bytes(this.state_root);
            }
            if (this.transactions_root.length > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(this.transactions_root.length);
              encoder.bytes(this.transactions_root);
            }
            if (this.receipt_root.length > 0) {
              encoder.uint32(0x32);
              encoder.uint32(this.receipt_root.length);
              encoder.bytes(this.receipt_root);
            }
            if (this.logs_bloom.length > 0) {
              encoder.uint32(0x3a);
              encoder.uint32(this.logs_bloom.length);
              encoder.bytes(this.logs_bloom);
            }

            if (this.difficulty != null) {
              const f = this.difficulty as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x42);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.total_difficulty != null) {
              const f = this.total_difficulty as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x8a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.number != 0) {
              encoder.uint32(0x48);
              encoder.uint64(this.number);
            }
            if (this.gas_limit != 0) {
              encoder.uint32(0x50);
              encoder.uint64(this.gas_limit);
            }
            if (this.gas_used != 0) {
              encoder.uint32(0x58);
              encoder.uint64(this.gas_used);
            }

            if (this.timestamp != null) {
              const f = this.timestamp as google.protobuf.Timestamp;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x62);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.extra_data.length > 0) {
              encoder.uint32(0x6a);
              encoder.uint32(this.extra_data.length);
              encoder.bytes(this.extra_data);
            }
            if (this.mix_hash.length > 0) {
              encoder.uint32(0x72);
              encoder.uint32(this.mix_hash.length);
              encoder.bytes(this.mix_hash);
            }
            if (this.nonce != 0) {
              encoder.uint32(0x78);
              encoder.uint64(this.nonce);
            }
            if (this.hash.length > 0) {
              encoder.uint32(0x82);
              encoder.uint32(this.hash.length);
              encoder.bytes(this.hash);
            }

            if (this.base_fee_per_gas != null) {
              const f = this.base_fee_per_gas as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x92);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.withdrawals_root.length > 0) {
              encoder.uint32(0x9a);
              encoder.uint32(this.withdrawals_root.length);
              encoder.bytes(this.withdrawals_root);
            }

            if (this.tx_dependency != null) {
              const f = this.tx_dependency as Uint64NestedArray;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0xa2);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.blob_gas_used != 0) {
              encoder.uint32(0xb0);
              encoder.uint64(this.blob_gas_used);
            }
            if (this.excess_blob_gas != 0) {
              encoder.uint32(0xb8);
              encoder.uint64(this.excess_blob_gas);
            }
            if (this.parent_beacon_root.length > 0) {
              encoder.uint32(0xc2);
              encoder.uint32(this.parent_beacon_root.length);
              encoder.bytes(this.parent_beacon_root);
            }

            return buf;
          } // encode BlockHeader
        } // BlockHeader

        export class Uint64NestedArray {
          public val: Array<Uint64Array> = new Array<Uint64Array>();

          // Decodes Uint64NestedArray from an ArrayBuffer
          static decode(buf: ArrayBuffer): Uint64NestedArray {
            return Uint64NestedArray.decodeDataView(new DataView(buf));
          }

          // Decodes Uint64NestedArray from a DataView
          static decodeDataView(view: DataView): Uint64NestedArray {
            const decoder = new __proto.Decoder(view);
            const obj = new Uint64NestedArray();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  const length = decoder.uint32();
                  obj.val.push(
                    Uint64Array.decodeDataView(
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
          } // decode Uint64NestedArray

          public size(): u32 {
            let size: u32 = 0;

            for (let n: i32 = 0; n < this.val.length; n++) {
              const messageSize = this.val[n].size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            return size;
          }

          // Encodes Uint64NestedArray to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes Uint64NestedArray to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            for (let n: i32 = 0; n < this.val.length; n++) {
              const messageSize = this.val[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xa);
                encoder.uint32(messageSize);
                this.val[n].encodeU8Array(encoder);
              }
            }

            return buf;
          } // encode Uint64NestedArray
        } // Uint64NestedArray

        export class Uint64Array {
          public val: Array<u64> = new Array<u64>();

          // Decodes Uint64Array from an ArrayBuffer
          static decode(buf: ArrayBuffer): Uint64Array {
            return Uint64Array.decodeDataView(new DataView(buf));
          }

          // Decodes Uint64Array from a DataView
          static decodeDataView(view: DataView): Uint64Array {
            const decoder = new __proto.Decoder(view);
            const obj = new Uint64Array();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  const endPos = decoder.pos + decoder.uint32();
                  while (decoder.pos <= endPos) {
                    obj.val.push(decoder.uint64());
                  }

                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode Uint64Array

          public size(): u32 {
            let size: u32 = 0;

            if (this.val.length > 0) {
              const packedSize = __size_uint64_repeated_packed(this.val);
              if (packedSize > 0) {
                size += 1 + __proto.Sizer.varint64(packedSize) + packedSize;
              }
            }

            return size;
          }

          // Encodes Uint64Array to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes Uint64Array to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.val.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(__size_uint64_repeated_packed(this.val));

              for (let n: i32 = 0; n < this.val.length; n++) {
                encoder.uint64(this.val[n]);
              }
            }

            return buf;
          } // encode Uint64Array
        } // Uint64Array

        export class BigInt {
          public bytes: Array<u8> = new Array<u8>();

          // Decodes BigInt from an ArrayBuffer
          static decode(buf: ArrayBuffer): BigInt {
            return BigInt.decodeDataView(new DataView(buf));
          }

          // Decodes BigInt from a DataView
          static decodeDataView(view: DataView): BigInt {
            const decoder = new __proto.Decoder(view);
            const obj = new BigInt();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.bytes = decoder.bytes();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode BigInt

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.bytes.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.bytes.length) +
                  this.bytes.length
                : 0;

            return size;
          }

          // Encodes BigInt to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes BigInt to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.bytes.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.bytes.length);
              encoder.bytes(this.bytes);
            }

            return buf;
          } // encode BigInt
        } // BigInt

        /**
         * TransactionTrace is full trace of execution of the transaction when the
         *  it actually executed on chain.
         *
         *  It contains all the transaction details like `from`, `to`, `gas`, etc.
         *  as well as all the internal calls that were made during the transaction.
         *
         *  The `calls` vector contains Call objects which have balance changes, events
         *  storage changes, etc.
         *
         *  If ordering is important between elements, almost each message like `Log`,
         *  `Call`, `StorageChange`, etc. have an ordinal field that is represents "execution"
         *  order of the said element against all other elements in this block.
         *
         *  Due to how the call tree works doing "naively", looping through all calls then
         *  through a Call's element like `logs` while not yielding the elements in the order
         *  they were executed on chain. A log in call could have been done before or after
         *  another in another call depending on the actual call tree.
         *
         *  The `calls` are ordered by creation order and the call tree can be re-computing
         *  using fields found in `Call` object (parent/child relationship).
         *
         *  Another important thing to note is that even if a transaction succeed, some calls
         *  within it could have been reverted internally, if this is important to you, you must
         *  check the field `state_reverted` on the `Call` to determine if it was fully committed
         *  to the chain or not.
         */
        export class TransactionTrace {
          // consensus
          public to: Array<u8> = new Array<u8>();
          public nonce: u64;
          /**
           * GasPrice represents the effective price that has been paid for each gas unit of this transaction. Over time, the
           *  Ethereum rules changes regarding GasPrice field here. Before London fork, the GasPrice was always set to the
           *  fixed gas price. After London fork, this value has different meaning depending on the transaction type (see `Type` field).
           *
           *  In cases where `TransactionTrace.Type == TRX_TYPE_LEGACY || TRX_TYPE_ACCESS_LIST`, then GasPrice has the same meaning
           *  as before the London fork.
           *
           *  In cases where `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE`, then GasPrice is the effective gas price paid
           *  for the transaction which is equals to `BlockHeader.BaseFeePerGas + TransactionTrace.`
           */
          public gas_price: BigInt = new BigInt();
          /**
           * GasLimit is the maximum of gas unit the sender of the transaction is willing to consume when perform the EVM
           *  execution of the whole transaction
           */
          public gas_limit: u64;
          // Value is the amount of Ether transferred as part of this transaction.
          public value: BigInt = new BigInt();
          // Input data the transaction will receive for execution of EVM.
          public input: Array<u8> = new Array<u8>();
          // V is the recovery ID value for the signature Y point.
          public v: Array<u8> = new Array<u8>();
          // R is the signature's X point on the elliptic curve (32 bytes).
          public r: Array<u8> = new Array<u8>();
          // S is the signature's Y point on the elliptic curve (32 bytes).
          public s: Array<u8> = new Array<u8>();
          // GasUsed is the total amount of gas unit used for the whole execution of the transaction.
          public gas_used: u64;
          /**
           * Type represents the Ethereum transaction type, available only since EIP-2718 & EIP-2930 activation which happened on Berlin fork.
           *  The value is always set even for transaction before Berlin fork because those before the fork are still legacy transactions.
           */
          public type: u32;
          /**
           * AcccessList represents the storage access this transaction has agreed to do in which case those storage
           *  access cost less gas unit per access.
           *
           *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_ACCESS_LIST || TRX_TYPE_DYNAMIC_FEE` which
           *  is possible only if Berlin (TRX_TYPE_ACCESS_LIST) nor London (TRX_TYPE_DYNAMIC_FEE) fork are active on the chain.
           */
          public access_list: Array<AccessTuple> = new Array<AccessTuple>();
          /**
           * MaxFeePerGas is the maximum fee per gas the user is willing to pay for the transaction gas used.
           *
           *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE` which is possible only
           *  if Londong fork is active on the chain.
           *
           *  Only available in DetailLevel: EXTENDED
           */
          public max_fee_per_gas: BigInt = new BigInt();
          /**
           * MaxPriorityFeePerGas is priority fee per gas the user to pay in extra to the miner on top of the block's
           *  base fee.
           *
           *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE` which is possible only
           *  if London fork is active on the chain.
           *
           *  Only available in DetailLevel: EXTENDED
           */
          public max_priority_fee_per_gas: BigInt = new BigInt();
          // meta
          public index: u32;
          public hash: Array<u8> = new Array<u8>();
          public from: Array<u8> = new Array<u8>();
          // Only available in DetailLevel: EXTENDED
          public return_data: Array<u8> = new Array<u8>();
          // Only available in DetailLevel: EXTENDED
          public public_key: Array<u8> = new Array<u8>();
          public begin_ordinal: u64;
          public end_ordinal: u64;
          /**
           * TransactionTraceStatus is the status of the transaction execution and will let you know if the transaction
           *  was successful or not.
           *
           *  A successful transaction has been recorded to the blockchain's state for calls in it that were successful.
           *  This means it's possible only a subset of the calls were properly recorded, refer to [calls[].state_reverted] field
           *  to determine which calls were reverted.
           *
           *  A quirks of the Ethereum protocol is that a transaction `FAILED` or `REVERTED` still affects the blockchain's
           *  state for **some** of the state changes. Indeed, in those cases, the transactions fees are still paid to the miner
           *  which means there is a balance change for the transaction's emitter (e.g. `from`) to pay the gas fees, an optional
           *  balance change for gas refunded to the transaction's emitter (e.g. `from`) and a balance change for the miner who
           *  received the transaction fees. There is also a nonce change for the transaction's emitter (e.g. `from`).
           *
           *  This means that to properly record the state changes for a transaction, you need to conditionally procees the
           *  transaction's status.
           *
           *  For a `SUCCEEDED` transaction, you iterate over the `calls` array and record the state changes for each call for
           *  which `state_reverted == false` (if a transaction succeeded, the call at #0 will always `state_reverted == false`
           *  because it aligns with the transaction).
           *
           *  For a `FAILED` or `REVERTED` transaction, you iterate over the root call (e.g. at #0, will always exist) for
           *  balance changes you process those where `reason` is either `REASON_GAS_BUY`, `REASON_GAS_REFUND` or
           *  `REASON_REWARD_TRANSACTION_FEE` and for nonce change, still on the root call, you pick the nonce change which the
           *  smallest ordinal (if more than one).
           */
          public status: u32;
          public receipt: TransactionReceipt = new TransactionReceipt();
          // Only available in DetailLevel: EXTENDED
          public calls: Array<Call> = new Array<Call>();
          /**
           * BlobGas is the amount of gas the transaction is going to pay for the blobs, this is a computed value
           *  equivalent to `self.blob_gas_fee_cap * len(self.blob_hashes)` and provided in the model for convenience.
           *
           *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
           *
           *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
           *  if Cancun fork is active on the chain.
           */
          public blob_gas: u64;
          /**
           * BlobGasFeeCap is the maximum fee per data gas the user is willing to pay for the data gas used.
           *
           *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
           *
           *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
           *  if Cancun fork is active on the chain.
           */
          public blob_gas_fee_cap: BigInt | null;
          /**
           * BlobHashes field represents a list of hash outputs from 'kzg_to_versioned_hash' which
           *  essentially is a version byte + the sha256 hash of the blob commitment (e.g.
           *  `BLOB_COMMITMENT_VERSION_KZG + sha256(commitment)[1:]`.
           *
           *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
           *
           *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
           *  if Cancun fork is active on the chain.
           */
          public blob_hashes: Array<Array<u8>> = new Array<Array<u8>>();

          public ___blob_gas: string = "";
          public ___blob_gas_index: u8 = 0;

          public ___blob_gas_fee_cap: string = "";
          public ___blob_gas_fee_cap_index: u8 = 0;

          static readonly BLOB_GAS_BLOB_GAS_INDEX: u8 = 33;
          static readonly BLOB_GAS_FEE_CAP_BLOB_GAS_FEE_CAP_INDEX: u8 = 34;

          // Decodes TransactionTrace from an ArrayBuffer
          static decode(buf: ArrayBuffer): TransactionTrace {
            return TransactionTrace.decodeDataView(new DataView(buf));
          }

          // Decodes TransactionTrace from a DataView
          static decodeDataView(view: DataView): TransactionTrace {
            const decoder = new __proto.Decoder(view);
            const obj = new TransactionTrace();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.to = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.nonce = decoder.uint64();
                  break;
                }
                case 3: {
                  const length = decoder.uint32();
                  obj.gas_price = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 4: {
                  obj.gas_limit = decoder.uint64();
                  break;
                }
                case 5: {
                  const length = decoder.uint32();
                  obj.value = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 6: {
                  obj.input = decoder.bytes();
                  break;
                }
                case 7: {
                  obj.v = decoder.bytes();
                  break;
                }
                case 8: {
                  obj.r = decoder.bytes();
                  break;
                }
                case 9: {
                  obj.s = decoder.bytes();
                  break;
                }
                case 10: {
                  obj.gas_used = decoder.uint64();
                  break;
                }
                case 12: {
                  obj.type = decoder.uint32();
                  break;
                }
                case 14: {
                  const length = decoder.uint32();
                  obj.access_list.push(
                    AccessTuple.decodeDataView(
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
                case 11: {
                  const length = decoder.uint32();
                  obj.max_fee_per_gas = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 13: {
                  const length = decoder.uint32();
                  obj.max_priority_fee_per_gas = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 20: {
                  obj.index = decoder.uint32();
                  break;
                }
                case 21: {
                  obj.hash = decoder.bytes();
                  break;
                }
                case 22: {
                  obj.from = decoder.bytes();
                  break;
                }
                case 23: {
                  obj.return_data = decoder.bytes();
                  break;
                }
                case 24: {
                  obj.public_key = decoder.bytes();
                  break;
                }
                case 25: {
                  obj.begin_ordinal = decoder.uint64();
                  break;
                }
                case 26: {
                  obj.end_ordinal = decoder.uint64();
                  break;
                }
                case 30: {
                  obj.status = decoder.uint32();
                  break;
                }
                case 31: {
                  const length = decoder.uint32();
                  obj.receipt = TransactionReceipt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 32: {
                  const length = decoder.uint32();
                  obj.calls.push(
                    Call.decodeDataView(
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
                case 33: {
                  obj.blob_gas = decoder.uint64();
                  obj.___blob_gas = "blob_gas";
                  obj.___blob_gas_index = 33;
                  break;
                }
                case 34: {
                  const length = decoder.uint32();
                  obj.blob_gas_fee_cap = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  obj.___blob_gas_fee_cap = "blob_gas_fee_cap";
                  obj.___blob_gas_fee_cap_index = 34;
                  break;
                }
                case 35: {
                  obj.blob_hashes.push(decoder.bytes());
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode TransactionTrace

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.to.length > 0
                ? 1 + __proto.Sizer.varint64(this.to.length) + this.to.length
                : 0;
            size += this.nonce == 0 ? 0 : 1 + __proto.Sizer.uint64(this.nonce);

            if (this.gas_price != null) {
              const f: BigInt = this.gas_price as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.gas_limit == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.gas_limit);

            if (this.value != null) {
              const f: BigInt = this.value as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.input.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.input.length) +
                  this.input.length
                : 0;
            size +=
              this.v.length > 0
                ? 1 + __proto.Sizer.varint64(this.v.length) + this.v.length
                : 0;
            size +=
              this.r.length > 0
                ? 1 + __proto.Sizer.varint64(this.r.length) + this.r.length
                : 0;
            size +=
              this.s.length > 0
                ? 1 + __proto.Sizer.varint64(this.s.length) + this.s.length
                : 0;
            size +=
              this.gas_used == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_used);
            size += this.type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.type);

            for (let n: i32 = 0; n < this.access_list.length; n++) {
              const messageSize = this.access_list[n].size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            if (this.max_fee_per_gas != null) {
              const f: BigInt = this.max_fee_per_gas as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            if (this.max_priority_fee_per_gas != null) {
              const f: BigInt = this.max_priority_fee_per_gas as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size += this.index == 0 ? 0 : 2 + __proto.Sizer.uint32(this.index);
            size +=
              this.hash.length > 0
                ? 2 +
                  __proto.Sizer.varint64(this.hash.length) +
                  this.hash.length
                : 0;
            size +=
              this.from.length > 0
                ? 2 +
                  __proto.Sizer.varint64(this.from.length) +
                  this.from.length
                : 0;
            size +=
              this.return_data.length > 0
                ? 2 +
                  __proto.Sizer.varint64(this.return_data.length) +
                  this.return_data.length
                : 0;
            size +=
              this.public_key.length > 0
                ? 2 +
                  __proto.Sizer.varint64(this.public_key.length) +
                  this.public_key.length
                : 0;
            size +=
              this.begin_ordinal == 0
                ? 0
                : 2 + __proto.Sizer.uint64(this.begin_ordinal);
            size +=
              this.end_ordinal == 0
                ? 0
                : 2 + __proto.Sizer.uint64(this.end_ordinal);
            size +=
              this.status == 0 ? 0 : 2 + __proto.Sizer.uint32(this.status);

            if (this.receipt != null) {
              const f: TransactionReceipt = this.receipt as TransactionReceipt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.calls.length; n++) {
              const messageSize = this.calls[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.blob_gas == 0 ? 0 : 2 + __proto.Sizer.uint64(this.blob_gas);

            if (this.blob_gas_fee_cap != null) {
              const f: BigInt = this.blob_gas_fee_cap as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size += __size_bytes_repeated(this.blob_hashes);

            return size;
          }

          // Encodes TransactionTrace to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes TransactionTrace to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.to.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.to.length);
              encoder.bytes(this.to);
            }
            if (this.nonce != 0) {
              encoder.uint32(0x10);
              encoder.uint64(this.nonce);
            }

            if (this.gas_price != null) {
              const f = this.gas_price as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x1a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.gas_limit != 0) {
              encoder.uint32(0x20);
              encoder.uint64(this.gas_limit);
            }

            if (this.value != null) {
              const f = this.value as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x2a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.input.length > 0) {
              encoder.uint32(0x32);
              encoder.uint32(this.input.length);
              encoder.bytes(this.input);
            }
            if (this.v.length > 0) {
              encoder.uint32(0x3a);
              encoder.uint32(this.v.length);
              encoder.bytes(this.v);
            }
            if (this.r.length > 0) {
              encoder.uint32(0x42);
              encoder.uint32(this.r.length);
              encoder.bytes(this.r);
            }
            if (this.s.length > 0) {
              encoder.uint32(0x4a);
              encoder.uint32(this.s.length);
              encoder.bytes(this.s);
            }
            if (this.gas_used != 0) {
              encoder.uint32(0x50);
              encoder.uint64(this.gas_used);
            }
            if (this.type != 0) {
              encoder.uint32(0x60);
              encoder.uint32(this.type);
            }

            for (let n: i32 = 0; n < this.access_list.length; n++) {
              const messageSize = this.access_list[n].size();

              if (messageSize > 0) {
                encoder.uint32(0x72);
                encoder.uint32(messageSize);
                this.access_list[n].encodeU8Array(encoder);
              }
            }

            if (this.max_fee_per_gas != null) {
              const f = this.max_fee_per_gas as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x5a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.max_priority_fee_per_gas != null) {
              const f = this.max_priority_fee_per_gas as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x6a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.index != 0) {
              encoder.uint32(0xa0);
              encoder.uint32(this.index);
            }
            if (this.hash.length > 0) {
              encoder.uint32(0xaa);
              encoder.uint32(this.hash.length);
              encoder.bytes(this.hash);
            }
            if (this.from.length > 0) {
              encoder.uint32(0xb2);
              encoder.uint32(this.from.length);
              encoder.bytes(this.from);
            }
            if (this.return_data.length > 0) {
              encoder.uint32(0xba);
              encoder.uint32(this.return_data.length);
              encoder.bytes(this.return_data);
            }
            if (this.public_key.length > 0) {
              encoder.uint32(0xc2);
              encoder.uint32(this.public_key.length);
              encoder.bytes(this.public_key);
            }
            if (this.begin_ordinal != 0) {
              encoder.uint32(0xc8);
              encoder.uint64(this.begin_ordinal);
            }
            if (this.end_ordinal != 0) {
              encoder.uint32(0xd0);
              encoder.uint64(this.end_ordinal);
            }
            if (this.status != 0) {
              encoder.uint32(0xf0);
              encoder.uint32(this.status);
            }

            if (this.receipt != null) {
              const f = this.receipt as TransactionReceipt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0xfa);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.calls.length; n++) {
              const messageSize = this.calls[n].size();

              if (messageSize > 0) {
                encoder.uint32(0x102);
                encoder.uint32(messageSize);
                this.calls[n].encodeU8Array(encoder);
              }
            }

            if (this.blob_gas != 0) {
              encoder.uint32(0x108);
              encoder.uint64(this.blob_gas);
            }

            if (this.blob_gas_fee_cap != null) {
              const f = this.blob_gas_fee_cap as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x112);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.blob_hashes.length > 0) {
              for (let n: i32 = 0; n < this.blob_hashes.length; n++) {
                encoder.uint32(0x11a);
                encoder.uint32(this.blob_hashes[n].length);
                encoder.bytes(this.blob_hashes[n]);
              }
            }

            return buf;
          } // encode TransactionTrace
        } // TransactionTrace

        export enum TransactionTrace_Type {
          // All transactions that ever existed prior Berlin fork before EIP-2718 was implemented.
          TRX_TYPE_LEGACY = 0,
          /**
           * Transaction that specicy an access list of contract/storage_keys that is going to be used
           *  in this transaction.
           *
           *  Added in Berlin fork (EIP-2930).
           */
          TRX_TYPE_ACCESS_LIST = 1,
          /**
           * Transaction that specifis an access list just like TRX_TYPE_ACCESS_LIST but in addition defines the
           *  max base gas gee and max priority gas fee to pay for this transaction. Transaction's of those type are
           *  executed against EIP-1559 rules which dictates a dynamic gas cost based on the congestion of the network.
           */
          TRX_TYPE_DYNAMIC_FEE = 2,
          /**
           * Transaction which contain a large amount of data that cannot be accessed by EVM execution, but whose commitment
           *  can be accessed. The format is intended to be fully compatible with the format that will be used in full sharding.
           *
           *  Transaction that defines specifis an access list just like TRX_TYPE_ACCESS_LIST and enables dynamic fee just like
           *  TRX_TYPE_DYNAMIC_FEE but in addition defines the fields 'max_fee_per_data_gas' of type 'uint256' and the fields
           *  'blob_versioned_hashes' field represents a list of hash outputs from 'kzg_to_versioned_hash'.
           *
           *  Activated in Dencun
           */
          TRX_TYPE_BLOB = 3,
          // Arbitrum-specific transactions
          TRX_TYPE_ARBITRUM_DEPOSIT = 100,
          TRX_TYPE_ARBITRUM_UNSIGNED = 101,
          TRX_TYPE_ARBITRUM_CONTRACT = 102,
          TRX_TYPE_ARBITRUM_RETRY = 104,
          TRX_TYPE_ARBITRUM_SUBMIT_RETRYABLE = 105,
          TRX_TYPE_ARBITRUM_INTERNAL = 106,
          TRX_TYPE_ARBITRUM_LEGACY = 120,
        } // TransactionTrace_Type
        /**
         * AccessTuple represents a list of storage keys for a given contract's address and is used
         *  for AccessList construction.
         */
        export class AccessTuple {
          public address: Array<u8> = new Array<u8>();
          public storage_keys: Array<Array<u8>> = new Array<Array<u8>>();

          // Decodes AccessTuple from an ArrayBuffer
          static decode(buf: ArrayBuffer): AccessTuple {
            return AccessTuple.decodeDataView(new DataView(buf));
          }

          // Decodes AccessTuple from a DataView
          static decodeDataView(view: DataView): AccessTuple {
            const decoder = new __proto.Decoder(view);
            const obj = new AccessTuple();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.address = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.storage_keys.push(decoder.bytes());
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode AccessTuple

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.address.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.address.length) +
                  this.address.length
                : 0;

            size += __size_bytes_repeated(this.storage_keys);

            return size;
          }

          // Encodes AccessTuple to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes AccessTuple to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.address.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.address.length);
              encoder.bytes(this.address);
            }

            if (this.storage_keys.length > 0) {
              for (let n: i32 = 0; n < this.storage_keys.length; n++) {
                encoder.uint32(0x12);
                encoder.uint32(this.storage_keys[n].length);
                encoder.bytes(this.storage_keys[n]);
              }
            }

            return buf;
          } // encode AccessTuple
        } // AccessTuple

        export class TransactionReceipt {
          /**
           * State root is an intermediate state_root hash, computed in-between transactions to make
           *  **sure** you could build a proof and point to state in the middle of a block. Geth client
           *  uses `PostState + root + PostStateOrStatus`` while Parity used `status_code, root...`` this piles
           *  hardforks, see (read the EIPs first):
           *  - https://github.com/ethereum/EIPs/blob/master/EIPS/eip-658.md
           *
           *  Moreover, the notion of `Outcome`` in parity, which segregates the two concepts, which are
           *  stored in the same field `status_code`` can be computed based on such a hack of the `state_root`
           *  field, following `EIP-658`.
           *
           *  Before Byzantinium hard fork, this field is always empty.
           */
          public state_root: Array<u8> = new Array<u8>();
          public cumulative_gas_used: u64;
          public logs_bloom: Array<u8> = new Array<u8>();
          public logs: Array<Log> = new Array<Log>();
          /**
           * BlobGasUsed is the amount of blob gas that has been used within this transaction. At time
           *  of writing, this is equal to `self.blob_gas_fee_cap * len(self.blob_hashes)`.
           *
           *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
           *
           *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
           *  if Cancun fork is active on the chain.
           */
          public blob_gas_used: u64;
          /**
           * BlobGasPrice is the amount to pay per blob item in the transaction.
           *
           *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
           *
           *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
           *  if Cancun fork is active on the chain.
           */
          public blob_gas_price: BigInt | null;

          public ___blob_gas_used: string = "";
          public ___blob_gas_used_index: u8 = 0;

          public ___blob_gas_price: string = "";
          public ___blob_gas_price_index: u8 = 0;

          static readonly BLOB_GAS_USED_BLOB_GAS_USED_INDEX: u8 = 5;
          static readonly BLOB_GAS_PRICE_BLOB_GAS_PRICE_INDEX: u8 = 6;

          // Decodes TransactionReceipt from an ArrayBuffer
          static decode(buf: ArrayBuffer): TransactionReceipt {
            return TransactionReceipt.decodeDataView(new DataView(buf));
          }

          // Decodes TransactionReceipt from a DataView
          static decodeDataView(view: DataView): TransactionReceipt {
            const decoder = new __proto.Decoder(view);
            const obj = new TransactionReceipt();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.state_root = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.cumulative_gas_used = decoder.uint64();
                  break;
                }
                case 3: {
                  obj.logs_bloom = decoder.bytes();
                  break;
                }
                case 4: {
                  const length = decoder.uint32();
                  obj.logs.push(
                    Log.decodeDataView(
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
                case 5: {
                  obj.blob_gas_used = decoder.uint64();
                  obj.___blob_gas_used = "blob_gas_used";
                  obj.___blob_gas_used_index = 5;
                  break;
                }
                case 6: {
                  const length = decoder.uint32();
                  obj.blob_gas_price = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  obj.___blob_gas_price = "blob_gas_price";
                  obj.___blob_gas_price_index = 6;
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode TransactionReceipt

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.state_root.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.state_root.length) +
                  this.state_root.length
                : 0;
            size +=
              this.cumulative_gas_used == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.cumulative_gas_used);
            size +=
              this.logs_bloom.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.logs_bloom.length) +
                  this.logs_bloom.length
                : 0;

            for (let n: i32 = 0; n < this.logs.length; n++) {
              const messageSize = this.logs[n].size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.blob_gas_used == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.blob_gas_used);

            if (this.blob_gas_price != null) {
              const f: BigInt = this.blob_gas_price as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            return size;
          }

          // Encodes TransactionReceipt to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes TransactionReceipt to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.state_root.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.state_root.length);
              encoder.bytes(this.state_root);
            }
            if (this.cumulative_gas_used != 0) {
              encoder.uint32(0x10);
              encoder.uint64(this.cumulative_gas_used);
            }
            if (this.logs_bloom.length > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(this.logs_bloom.length);
              encoder.bytes(this.logs_bloom);
            }

            for (let n: i32 = 0; n < this.logs.length; n++) {
              const messageSize = this.logs[n].size();

              if (messageSize > 0) {
                encoder.uint32(0x22);
                encoder.uint32(messageSize);
                this.logs[n].encodeU8Array(encoder);
              }
            }

            if (this.blob_gas_used != 0) {
              encoder.uint32(0x28);
              encoder.uint64(this.blob_gas_used);
            }

            if (this.blob_gas_price != null) {
              const f = this.blob_gas_price as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x32);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            return buf;
          } // encode TransactionReceipt
        } // TransactionReceipt

        export class Log {
          public address: Array<u8> = new Array<u8>();
          public topics: Array<Array<u8>> = new Array<Array<u8>>();
          public data: Array<u8> = new Array<u8>();
          /**
           * Index is the index of the log relative to the transaction. This index
           *  is always populated regardless of the state revertion of the the call
           *  that emitted this log.
           *
           *  Only available in DetailLevel: EXTENDED
           */
          public index: u32;
          /**
           * BlockIndex represents the index of the log relative to the Block.
           *
           *  An **important** notice is that this field will be 0 when the call
           *  that emitted the log has been reverted by the chain.
           *
           *  Currently, there is two locations where a Log can be obtained:
           *  - block.transaction_traces[].receipt.logs[]
           *  - block.transaction_traces[].calls[].logs[]
           *
           *  In the `receipt` case, the logs will be populated only when the call
           *  that emitted them has not been reverted by the chain and when in this
           *  position, the `blockIndex` is always populated correctly.
           *
           *  In the case of `calls` case, for `call` where `stateReverted == true`,
           *  the `blockIndex` value will always be 0.
           */
          public blockIndex: u32;
          public ordinal: u64;

          // Decodes Log from an ArrayBuffer
          static decode(buf: ArrayBuffer): Log {
            return Log.decodeDataView(new DataView(buf));
          }

          // Decodes Log from a DataView
          static decodeDataView(view: DataView): Log {
            const decoder = new __proto.Decoder(view);
            const obj = new Log();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.address = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.topics.push(decoder.bytes());
                  break;
                }
                case 3: {
                  obj.data = decoder.bytes();
                  break;
                }
                case 4: {
                  obj.index = decoder.uint32();
                  break;
                }
                case 6: {
                  obj.blockIndex = decoder.uint32();
                  break;
                }
                case 7: {
                  obj.ordinal = decoder.uint64();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode Log

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.address.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.address.length) +
                  this.address.length
                : 0;

            size += __size_bytes_repeated(this.topics);

            size +=
              this.data.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.data.length) +
                  this.data.length
                : 0;
            size += this.index == 0 ? 0 : 1 + __proto.Sizer.uint32(this.index);
            size +=
              this.blockIndex == 0
                ? 0
                : 1 + __proto.Sizer.uint32(this.blockIndex);
            size +=
              this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

            return size;
          }

          // Encodes Log to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes Log to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.address.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.address.length);
              encoder.bytes(this.address);
            }

            if (this.topics.length > 0) {
              for (let n: i32 = 0; n < this.topics.length; n++) {
                encoder.uint32(0x12);
                encoder.uint32(this.topics[n].length);
                encoder.bytes(this.topics[n]);
              }
            }

            if (this.data.length > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(this.data.length);
              encoder.bytes(this.data);
            }
            if (this.index != 0) {
              encoder.uint32(0x20);
              encoder.uint32(this.index);
            }
            if (this.blockIndex != 0) {
              encoder.uint32(0x30);
              encoder.uint32(this.blockIndex);
            }
            if (this.ordinal != 0) {
              encoder.uint32(0x38);
              encoder.uint64(this.ordinal);
            }

            return buf;
          } // encode Log
        } // Log

        export class Call {
          public index: u32;
          public parent_index: u32;
          public depth: u32;
          public call_type: u32;
          public caller: Array<u8> = new Array<u8>();
          public address: Array<u8> = new Array<u8>();
          public value: BigInt = new BigInt();
          public gas_limit: u64;
          public gas_consumed: u64;
          public return_data: Array<u8> = new Array<u8>();
          public input: Array<u8> = new Array<u8>();
          public executed_code: bool;
          public suicide: bool;
          // hex representation of the hash -> preimage
          public keccak_preimages: Map<string, string> = new Map<
            string,
            string
          >();
          public storage_changes: Array<StorageChange> =
            new Array<StorageChange>();
          public balance_changes: Array<BalanceChange> =
            new Array<BalanceChange>();
          public nonce_changes: Array<NonceChange> = new Array<NonceChange>();
          public logs: Array<Log> = new Array<Log>();
          public code_changes: Array<CodeChange> = new Array<CodeChange>();
          public gas_changes: Array<GasChange> = new Array<GasChange>();
          /**
           * In Ethereum, a call can be either:
           *  - Successfull, execution passes without any problem encountered
           *  - Failed, execution failed, and remaining gas should be consumed
           *  - Reverted, execution failed, but only gas consumed so far is billed, remaining gas is refunded
           *
           *  When a call is either `failed` or `reverted`, the `status_failed` field
           *  below is set to `true`. If the status is `reverted`, then both `status_failed`
           *  and `status_reverted` are going to be set to `true`.
           */
          public status_failed: bool;
          public status_reverted: bool;
          /**
           * Populated when a call either failed or reverted, so when `status_failed == true`,
           *  see above for details about those flags.
           */
          public failure_reason: string = "";
          /**
           * This field represents wheter or not the state changes performed
           *  by this call were correctly recorded by the blockchain.
           *
           *  On Ethereum, a transaction can record state changes even if some
           *  of its inner nested calls failed. This is problematic however since
           *  a call will invalidate all its state changes as well as all state
           *  changes performed by its child call. This means that even if a call
           *  has a status of `SUCCESS`, the chain might have reverted all the state
           *  changes it performed.
           *
           *  ```text
           *    Trx 1
           *     Call #1 <Failed>
           *       Call #2 <Execution Success>
           *       Call #3 <Execution Success>
           *       |--- Failure here
           *     Call #4
           *  ```
           *
           *  In the transaction above, while Call #2 and Call #3 would have the
           *  status `EXECUTED`.
           *
           *  If you check all calls and check only `state_reverted` flag, you might be missing
           *  some balance changes and nonce changes. This is because when a full transaction fails
           *  in ethereum (e.g. `calls.all(x.state_reverted == true)`), there is still the transaction
           *  fee that are recorded to the chain.
           *
           *  Refer to [TransactionTrace#status] field for more details about the handling you must
           *  perform.
           */
          public state_reverted: bool;
          public begin_ordinal: u64;
          public end_ordinal: u64;
          public account_creations: Array<AccountCreation> =
            new Array<AccountCreation>();

          // Decodes Call from an ArrayBuffer
          static decode(buf: ArrayBuffer): Call {
            return Call.decodeDataView(new DataView(buf));
          }

          // Decodes Call from a DataView
          static decodeDataView(view: DataView): Call {
            const decoder = new __proto.Decoder(view);
            const obj = new Call();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.index = decoder.uint32();
                  break;
                }
                case 2: {
                  obj.parent_index = decoder.uint32();
                  break;
                }
                case 3: {
                  obj.depth = decoder.uint32();
                  break;
                }
                case 4: {
                  obj.call_type = decoder.uint32();
                  break;
                }
                case 5: {
                  obj.caller = decoder.bytes();
                  break;
                }
                case 6: {
                  obj.address = decoder.bytes();
                  break;
                }
                case 7: {
                  const length = decoder.uint32();
                  obj.value = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 8: {
                  obj.gas_limit = decoder.uint64();
                  break;
                }
                case 9: {
                  obj.gas_consumed = decoder.uint64();
                  break;
                }
                case 13: {
                  obj.return_data = decoder.bytes();
                  break;
                }
                case 14: {
                  obj.input = decoder.bytes();
                  break;
                }
                case 15: {
                  obj.executed_code = decoder.bool();
                  break;
                }
                case 16: {
                  obj.suicide = decoder.bool();
                  break;
                }
                case 20: {
                  const length = decoder.uint32();
                  __decodeMap_string_string(
                    decoder,
                    length,
                    obj.keccak_preimages
                  );
                  decoder.skip(length);

                  break;
                }
                case 21: {
                  const length = decoder.uint32();
                  obj.storage_changes.push(
                    StorageChange.decodeDataView(
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
                case 22: {
                  const length = decoder.uint32();
                  obj.balance_changes.push(
                    BalanceChange.decodeDataView(
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
                case 24: {
                  const length = decoder.uint32();
                  obj.nonce_changes.push(
                    NonceChange.decodeDataView(
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
                case 25: {
                  const length = decoder.uint32();
                  obj.logs.push(
                    Log.decodeDataView(
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
                case 26: {
                  const length = decoder.uint32();
                  obj.code_changes.push(
                    CodeChange.decodeDataView(
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
                case 28: {
                  const length = decoder.uint32();
                  obj.gas_changes.push(
                    GasChange.decodeDataView(
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
                case 10: {
                  obj.status_failed = decoder.bool();
                  break;
                }
                case 12: {
                  obj.status_reverted = decoder.bool();
                  break;
                }
                case 11: {
                  obj.failure_reason = decoder.string();
                  break;
                }
                case 30: {
                  obj.state_reverted = decoder.bool();
                  break;
                }
                case 31: {
                  obj.begin_ordinal = decoder.uint64();
                  break;
                }
                case 32: {
                  obj.end_ordinal = decoder.uint64();
                  break;
                }
                case 33: {
                  const length = decoder.uint32();
                  obj.account_creations.push(
                    AccountCreation.decodeDataView(
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
          } // decode Call

          public size(): u32 {
            let size: u32 = 0;

            size += this.index == 0 ? 0 : 1 + __proto.Sizer.uint32(this.index);
            size +=
              this.parent_index == 0
                ? 0
                : 1 + __proto.Sizer.uint32(this.parent_index);
            size += this.depth == 0 ? 0 : 1 + __proto.Sizer.uint32(this.depth);
            size +=
              this.call_type == 0
                ? 0
                : 1 + __proto.Sizer.uint32(this.call_type);
            size +=
              this.caller.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.caller.length) +
                  this.caller.length
                : 0;
            size +=
              this.address.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.address.length) +
                  this.address.length
                : 0;

            if (this.value != null) {
              const f: BigInt = this.value as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.gas_limit == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.gas_limit);
            size +=
              this.gas_consumed == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.gas_consumed);
            size +=
              this.return_data.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.return_data.length) +
                  this.return_data.length
                : 0;
            size +=
              this.input.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.input.length) +
                  this.input.length
                : 0;
            size += this.executed_code == 0 ? 0 : 1 + 1;
            size += this.suicide == 0 ? 0 : 2 + 1;

            if (this.keccak_preimages.size > 0) {
              const keys = this.keccak_preimages.keys();

              for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const value = this.keccak_preimages.get(key);
                const itemSize = __sizeMapEntry_string_string(key, value);
                if (itemSize > 0) {
                  size += 2 + __proto.Sizer.varint64(itemSize) + itemSize;
                }
              }
            }

            for (let n: i32 = 0; n < this.storage_changes.length; n++) {
              const messageSize = this.storage_changes[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.balance_changes.length; n++) {
              const messageSize = this.balance_changes[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.nonce_changes.length; n++) {
              const messageSize = this.nonce_changes[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.logs.length; n++) {
              const messageSize = this.logs[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.code_changes.length; n++) {
              const messageSize = this.code_changes[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            for (let n: i32 = 0; n < this.gas_changes.length; n++) {
              const messageSize = this.gas_changes[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size += this.status_failed == 0 ? 0 : 1 + 1;
            size += this.status_reverted == 0 ? 0 : 1 + 1;
            size +=
              this.failure_reason.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.failure_reason.length) +
                  this.failure_reason.length
                : 0;
            size += this.state_reverted == 0 ? 0 : 2 + 1;
            size +=
              this.begin_ordinal == 0
                ? 0
                : 2 + __proto.Sizer.uint64(this.begin_ordinal);
            size +=
              this.end_ordinal == 0
                ? 0
                : 2 + __proto.Sizer.uint64(this.end_ordinal);

            for (let n: i32 = 0; n < this.account_creations.length; n++) {
              const messageSize = this.account_creations[n].size();

              if (messageSize > 0) {
                size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            return size;
          }

          // Encodes Call to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes Call to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.index != 0) {
              encoder.uint32(0x8);
              encoder.uint32(this.index);
            }
            if (this.parent_index != 0) {
              encoder.uint32(0x10);
              encoder.uint32(this.parent_index);
            }
            if (this.depth != 0) {
              encoder.uint32(0x18);
              encoder.uint32(this.depth);
            }
            if (this.call_type != 0) {
              encoder.uint32(0x20);
              encoder.uint32(this.call_type);
            }
            if (this.caller.length > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(this.caller.length);
              encoder.bytes(this.caller);
            }
            if (this.address.length > 0) {
              encoder.uint32(0x32);
              encoder.uint32(this.address.length);
              encoder.bytes(this.address);
            }

            if (this.value != null) {
              const f = this.value as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x3a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.gas_limit != 0) {
              encoder.uint32(0x40);
              encoder.uint64(this.gas_limit);
            }
            if (this.gas_consumed != 0) {
              encoder.uint32(0x48);
              encoder.uint64(this.gas_consumed);
            }
            if (this.return_data.length > 0) {
              encoder.uint32(0x6a);
              encoder.uint32(this.return_data.length);
              encoder.bytes(this.return_data);
            }
            if (this.input.length > 0) {
              encoder.uint32(0x72);
              encoder.uint32(this.input.length);
              encoder.bytes(this.input);
            }
            if (this.executed_code != 0) {
              encoder.uint32(0x78);
              encoder.bool(this.executed_code);
            }
            if (this.suicide != 0) {
              encoder.uint32(0x80);
              encoder.bool(this.suicide);
            }

            if (this.keccak_preimages.size > 0) {
              const keys = this.keccak_preimages.keys();
              for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const value = this.keccak_preimages.get(key);
                const size = __sizeMapEntry_string_string(key, value);
                if (size > 0) {
                  encoder.uint32(0xa2);
                  encoder.uint32(size);
                  if (key.length > 0) {
                    encoder.uint32(0xa);
                    encoder.uint32(key.length);
                    encoder.string(key);
                  }
                  if (value.length > 0) {
                    encoder.uint32(0x12);
                    encoder.uint32(value.length);
                    encoder.string(value);
                  }
                }
              }
            }

            for (let n: i32 = 0; n < this.storage_changes.length; n++) {
              const messageSize = this.storage_changes[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xaa);
                encoder.uint32(messageSize);
                this.storage_changes[n].encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.balance_changes.length; n++) {
              const messageSize = this.balance_changes[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xb2);
                encoder.uint32(messageSize);
                this.balance_changes[n].encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.nonce_changes.length; n++) {
              const messageSize = this.nonce_changes[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xc2);
                encoder.uint32(messageSize);
                this.nonce_changes[n].encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.logs.length; n++) {
              const messageSize = this.logs[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xca);
                encoder.uint32(messageSize);
                this.logs[n].encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.code_changes.length; n++) {
              const messageSize = this.code_changes[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xd2);
                encoder.uint32(messageSize);
                this.code_changes[n].encodeU8Array(encoder);
              }
            }

            for (let n: i32 = 0; n < this.gas_changes.length; n++) {
              const messageSize = this.gas_changes[n].size();

              if (messageSize > 0) {
                encoder.uint32(0xe2);
                encoder.uint32(messageSize);
                this.gas_changes[n].encodeU8Array(encoder);
              }
            }

            if (this.status_failed != 0) {
              encoder.uint32(0x50);
              encoder.bool(this.status_failed);
            }
            if (this.status_reverted != 0) {
              encoder.uint32(0x60);
              encoder.bool(this.status_reverted);
            }
            if (this.failure_reason.length > 0) {
              encoder.uint32(0x5a);
              encoder.uint32(this.failure_reason.length);
              encoder.string(this.failure_reason);
            }
            if (this.state_reverted != 0) {
              encoder.uint32(0xf0);
              encoder.bool(this.state_reverted);
            }
            if (this.begin_ordinal != 0) {
              encoder.uint32(0xf8);
              encoder.uint64(this.begin_ordinal);
            }
            if (this.end_ordinal != 0) {
              encoder.uint32(0x100);
              encoder.uint64(this.end_ordinal);
            }

            for (let n: i32 = 0; n < this.account_creations.length; n++) {
              const messageSize = this.account_creations[n].size();

              if (messageSize > 0) {
                encoder.uint32(0x10a);
                encoder.uint32(messageSize);
                this.account_creations[n].encodeU8Array(encoder);
              }
            }

            return buf;
          } // encode Call
        } // Call

        export class StorageChange {
          public address: Array<u8> = new Array<u8>();
          public key: Array<u8> = new Array<u8>();
          public old_value: Array<u8> = new Array<u8>();
          public new_value: Array<u8> = new Array<u8>();
          public ordinal: u64;

          // Decodes StorageChange from an ArrayBuffer
          static decode(buf: ArrayBuffer): StorageChange {
            return StorageChange.decodeDataView(new DataView(buf));
          }

          // Decodes StorageChange from a DataView
          static decodeDataView(view: DataView): StorageChange {
            const decoder = new __proto.Decoder(view);
            const obj = new StorageChange();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.address = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.key = decoder.bytes();
                  break;
                }
                case 3: {
                  obj.old_value = decoder.bytes();
                  break;
                }
                case 4: {
                  obj.new_value = decoder.bytes();
                  break;
                }
                case 5: {
                  obj.ordinal = decoder.uint64();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode StorageChange

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.address.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.address.length) +
                  this.address.length
                : 0;
            size +=
              this.key.length > 0
                ? 1 + __proto.Sizer.varint64(this.key.length) + this.key.length
                : 0;
            size +=
              this.old_value.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.old_value.length) +
                  this.old_value.length
                : 0;
            size +=
              this.new_value.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.new_value.length) +
                  this.new_value.length
                : 0;
            size +=
              this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

            return size;
          }

          // Encodes StorageChange to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes StorageChange to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.address.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.address.length);
              encoder.bytes(this.address);
            }
            if (this.key.length > 0) {
              encoder.uint32(0x12);
              encoder.uint32(this.key.length);
              encoder.bytes(this.key);
            }
            if (this.old_value.length > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(this.old_value.length);
              encoder.bytes(this.old_value);
            }
            if (this.new_value.length > 0) {
              encoder.uint32(0x22);
              encoder.uint32(this.new_value.length);
              encoder.bytes(this.new_value);
            }
            if (this.ordinal != 0) {
              encoder.uint32(0x28);
              encoder.uint64(this.ordinal);
            }

            return buf;
          } // encode StorageChange
        } // StorageChange

        export class BalanceChange {
          public address: Array<u8> = new Array<u8>();
          public old_value: BigInt = new BigInt();
          public new_value: BigInt = new BigInt();
          public reason: u32;
          public ordinal: u64;

          // Decodes BalanceChange from an ArrayBuffer
          static decode(buf: ArrayBuffer): BalanceChange {
            return BalanceChange.decodeDataView(new DataView(buf));
          }

          // Decodes BalanceChange from a DataView
          static decodeDataView(view: DataView): BalanceChange {
            const decoder = new __proto.Decoder(view);
            const obj = new BalanceChange();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.address = decoder.bytes();
                  break;
                }
                case 2: {
                  const length = decoder.uint32();
                  obj.old_value = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 3: {
                  const length = decoder.uint32();
                  obj.new_value = BigInt.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 4: {
                  obj.reason = decoder.uint32();
                  break;
                }
                case 5: {
                  obj.ordinal = decoder.uint64();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode BalanceChange

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.address.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.address.length) +
                  this.address.length
                : 0;

            if (this.old_value != null) {
              const f: BigInt = this.old_value as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            if (this.new_value != null) {
              const f: BigInt = this.new_value as BigInt;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size +=
              this.reason == 0 ? 0 : 1 + __proto.Sizer.uint32(this.reason);
            size +=
              this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

            return size;
          }

          // Encodes BalanceChange to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes BalanceChange to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.address.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.address.length);
              encoder.bytes(this.address);
            }

            if (this.old_value != null) {
              const f = this.old_value as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x12);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.new_value != null) {
              const f = this.new_value as BigInt;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x1a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.reason != 0) {
              encoder.uint32(0x20);
              encoder.uint32(this.reason);
            }
            if (this.ordinal != 0) {
              encoder.uint32(0x28);
              encoder.uint64(this.ordinal);
            }

            return buf;
          } // encode BalanceChange
        } // BalanceChange

        /**
         * Obtain all balanche change reasons under deep mind repository:
         *
         *  ```shell
         *  ack -ho 'BalanceChangeReason\(".*"\)' | grep -Eo '".*"' | sort | uniq
         *  ```
         */
        export enum BalanceChange_Reason {
          REASON_UNKNOWN = 0,
          REASON_REWARD_MINE_UNCLE = 1,
          REASON_REWARD_MINE_BLOCK = 2,
          REASON_DAO_REFUND_CONTRACT = 3,
          REASON_DAO_ADJUST_BALANCE = 4,
          REASON_TRANSFER = 5,
          REASON_GENESIS_BALANCE = 6,
          REASON_GAS_BUY = 7,
          REASON_REWARD_TRANSACTION_FEE = 8,
          REASON_REWARD_FEE_RESET = 14,
          REASON_GAS_REFUND = 9,
          REASON_TOUCH_ACCOUNT = 10,
          REASON_SUICIDE_REFUND = 11,
          REASON_SUICIDE_WITHDRAW = 13,
          REASON_CALL_BALANCE_OVERRIDE = 12,
          // Used on chain(s) where some Ether burning happens
          REASON_BURN = 15,
          REASON_WITHDRAWAL = 16,
        } // BalanceChange_Reason
        export class NonceChange {
          public address: Array<u8> = new Array<u8>();
          public old_value: u64;
          public new_value: u64;
          public ordinal: u64;

          // Decodes NonceChange from an ArrayBuffer
          static decode(buf: ArrayBuffer): NonceChange {
            return NonceChange.decodeDataView(new DataView(buf));
          }

          // Decodes NonceChange from a DataView
          static decodeDataView(view: DataView): NonceChange {
            const decoder = new __proto.Decoder(view);
            const obj = new NonceChange();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.address = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.old_value = decoder.uint64();
                  break;
                }
                case 3: {
                  obj.new_value = decoder.uint64();
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
          } // decode NonceChange

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.address.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.address.length) +
                  this.address.length
                : 0;
            size +=
              this.old_value == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.old_value);
            size +=
              this.new_value == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.new_value);
            size +=
              this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

            return size;
          }

          // Encodes NonceChange to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes NonceChange to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.address.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.address.length);
              encoder.bytes(this.address);
            }
            if (this.old_value != 0) {
              encoder.uint32(0x10);
              encoder.uint64(this.old_value);
            }
            if (this.new_value != 0) {
              encoder.uint32(0x18);
              encoder.uint64(this.new_value);
            }
            if (this.ordinal != 0) {
              encoder.uint32(0x20);
              encoder.uint64(this.ordinal);
            }

            return buf;
          } // encode NonceChange
        } // NonceChange

        export class AccountCreation {
          public account: Array<u8> = new Array<u8>();
          public ordinal: u64;

          // Decodes AccountCreation from an ArrayBuffer
          static decode(buf: ArrayBuffer): AccountCreation {
            return AccountCreation.decodeDataView(new DataView(buf));
          }

          // Decodes AccountCreation from a DataView
          static decodeDataView(view: DataView): AccountCreation {
            const decoder = new __proto.Decoder(view);
            const obj = new AccountCreation();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.account = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.ordinal = decoder.uint64();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode AccountCreation

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.account.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.account.length) +
                  this.account.length
                : 0;
            size +=
              this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

            return size;
          }

          // Encodes AccountCreation to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes AccountCreation to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.account.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.account.length);
              encoder.bytes(this.account);
            }
            if (this.ordinal != 0) {
              encoder.uint32(0x10);
              encoder.uint64(this.ordinal);
            }

            return buf;
          } // encode AccountCreation
        } // AccountCreation

        export class CodeChange {
          public address: Array<u8> = new Array<u8>();
          public old_hash: Array<u8> = new Array<u8>();
          public old_code: Array<u8> = new Array<u8>();
          public new_hash: Array<u8> = new Array<u8>();
          public new_code: Array<u8> = new Array<u8>();
          public ordinal: u64;

          // Decodes CodeChange from an ArrayBuffer
          static decode(buf: ArrayBuffer): CodeChange {
            return CodeChange.decodeDataView(new DataView(buf));
          }

          // Decodes CodeChange from a DataView
          static decodeDataView(view: DataView): CodeChange {
            const decoder = new __proto.Decoder(view);
            const obj = new CodeChange();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.address = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.old_hash = decoder.bytes();
                  break;
                }
                case 3: {
                  obj.old_code = decoder.bytes();
                  break;
                }
                case 4: {
                  obj.new_hash = decoder.bytes();
                  break;
                }
                case 5: {
                  obj.new_code = decoder.bytes();
                  break;
                }
                case 6: {
                  obj.ordinal = decoder.uint64();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode CodeChange

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.address.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.address.length) +
                  this.address.length
                : 0;
            size +=
              this.old_hash.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.old_hash.length) +
                  this.old_hash.length
                : 0;
            size +=
              this.old_code.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.old_code.length) +
                  this.old_code.length
                : 0;
            size +=
              this.new_hash.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.new_hash.length) +
                  this.new_hash.length
                : 0;
            size +=
              this.new_code.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.new_code.length) +
                  this.new_code.length
                : 0;
            size +=
              this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

            return size;
          }

          // Encodes CodeChange to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes CodeChange to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.address.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.address.length);
              encoder.bytes(this.address);
            }
            if (this.old_hash.length > 0) {
              encoder.uint32(0x12);
              encoder.uint32(this.old_hash.length);
              encoder.bytes(this.old_hash);
            }
            if (this.old_code.length > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(this.old_code.length);
              encoder.bytes(this.old_code);
            }
            if (this.new_hash.length > 0) {
              encoder.uint32(0x22);
              encoder.uint32(this.new_hash.length);
              encoder.bytes(this.new_hash);
            }
            if (this.new_code.length > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(this.new_code.length);
              encoder.bytes(this.new_code);
            }
            if (this.ordinal != 0) {
              encoder.uint32(0x30);
              encoder.uint64(this.ordinal);
            }

            return buf;
          } // encode CodeChange
        } // CodeChange

        /**
         * The gas change model represents the reason why some gas cost has occurred.
         *  The gas is computed per actual op codes. Doing them completely might prove
         *  overwhelming in most cases.
         *
         *  Hence, we only index some of them, those that are costy like all the calls
         *  one, log events, return data, etc.
         */
        export class GasChange {
          public old_value: u64;
          public new_value: u64;
          public reason: u32;
          public ordinal: u64;

          // Decodes GasChange from an ArrayBuffer
          static decode(buf: ArrayBuffer): GasChange {
            return GasChange.decodeDataView(new DataView(buf));
          }

          // Decodes GasChange from a DataView
          static decodeDataView(view: DataView): GasChange {
            const decoder = new __proto.Decoder(view);
            const obj = new GasChange();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.old_value = decoder.uint64();
                  break;
                }
                case 2: {
                  obj.new_value = decoder.uint64();
                  break;
                }
                case 3: {
                  obj.reason = decoder.uint32();
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
          } // decode GasChange

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.old_value == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.old_value);
            size +=
              this.new_value == 0
                ? 0
                : 1 + __proto.Sizer.uint64(this.new_value);
            size +=
              this.reason == 0 ? 0 : 1 + __proto.Sizer.uint32(this.reason);
            size +=
              this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

            return size;
          }

          // Encodes GasChange to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes GasChange to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.old_value != 0) {
              encoder.uint32(0x8);
              encoder.uint64(this.old_value);
            }
            if (this.new_value != 0) {
              encoder.uint32(0x10);
              encoder.uint64(this.new_value);
            }
            if (this.reason != 0) {
              encoder.uint32(0x18);
              encoder.uint32(this.reason);
            }
            if (this.ordinal != 0) {
              encoder.uint32(0x20);
              encoder.uint64(this.ordinal);
            }

            return buf;
          } // encode GasChange
        } // GasChange

        /**
         * Obtain all gas change reasons under deep mind repository:
         *
         *  ```shell
         *  ack -ho 'GasChangeReason\(".*"\)' | grep -Eo '".*"' | sort | uniq
         *  ```
         */
        export enum GasChange_Reason {
          REASON_UNKNOWN = 0,
          // REASON_CALL is the amount of gas that will be charged for a 'CALL' opcode executed by the EVM
          REASON_CALL = 1,
          // REASON_CALL_CODE is the amount of gas that will be charged for a 'CALLCODE' opcode executed by the EVM
          REASON_CALL_CODE = 2,
          // REASON_CALL_DATA_COPY is the amount of gas that will be charged for a 'CALLDATACOPY' opcode executed by the EVM
          REASON_CALL_DATA_COPY = 3,
          // REASON_CODE_COPY is the amount of gas that will be charged for a 'CALLDATACOPY' opcode executed by the EVM
          REASON_CODE_COPY = 4,
          // REASON_CODE_STORAGE is the amount of gas that will be charged for code storage
          REASON_CODE_STORAGE = 5,
          /**
           * REASON_CONTRACT_CREATION is the amount of gas that will be charged for a 'CREATE' opcode executed by the EVM and for the gas
           *  burned for a CREATE, today controlled by EIP150 rules
           */
          REASON_CONTRACT_CREATION = 6,
          /**
           * REASON_CONTRACT_CREATION2 is the amount of gas that will be charged for a 'CREATE2' opcode executed by the EVM and for the gas
           *  burned for a CREATE2, today controlled by EIP150 rules
           */
          REASON_CONTRACT_CREATION2 = 7,
          // REASON_DELEGATE_CALL is the amount of gas that will be charged for a 'DELEGATECALL' opcode executed by the EVM
          REASON_DELEGATE_CALL = 8,
          // REASON_EVENT_LOG is the amount of gas that will be charged for a 'LOG<N>' opcode executed by the EVM
          REASON_EVENT_LOG = 9,
          // REASON_EXT_CODE_COPY is the amount of gas that will be charged for a 'LOG<N>' opcode executed by the EVM
          REASON_EXT_CODE_COPY = 10,
          // REASON_FAILED_EXECUTION is the burning of the remaining gas when the execution failed without a revert
          REASON_FAILED_EXECUTION = 11,
          /**
           * REASON_INTRINSIC_GAS is the amount of gas that will be charged for the intrinsic cost of the transaction, there is
           *  always exactly one of those per transaction
           */
          REASON_INTRINSIC_GAS = 12,
          // GasChangePrecompiledContract is the amount of gas that will be charged for a precompiled contract execution
          REASON_PRECOMPILED_CONTRACT = 13,
          /**
           * REASON_REFUND_AFTER_EXECUTION is the amount of gas that will be refunded to the caller after the execution of the call,
           *  if there is left over at the end of execution
           */
          REASON_REFUND_AFTER_EXECUTION = 14,
          // REASON_RETURN is the amount of gas that will be charged for a 'RETURN' opcode executed by the EVM
          REASON_RETURN = 15,
          // REASON_RETURN_DATA_COPY is the amount of gas that will be charged for a 'RETURNDATACOPY' opcode executed by the EVM
          REASON_RETURN_DATA_COPY = 16,
          // REASON_REVERT is the amount of gas that will be charged for a 'REVERT' opcode executed by the EVM
          REASON_REVERT = 17,
          // REASON_SELF_DESTRUCT is the amount of gas that will be charged for a 'SELFDESTRUCT' opcode executed by the EVM
          REASON_SELF_DESTRUCT = 18,
          // REASON_STATIC_CALL is the amount of gas that will be charged for a 'STATICALL' opcode executed by the EVM
          REASON_STATIC_CALL = 19,
          /**
           * REASON_STATE_COLD_ACCESS is the amount of gas that will be charged for a cold storage access as controlled by EIP2929 rules
           *
           *  Added in Berlin fork (Geth 1.10+)
           */
          REASON_STATE_COLD_ACCESS = 20,
          /**
           * REASON_TX_INITIAL_BALANCE is the initial balance for the call which will be equal to the gasLimit of the call
           *
           *  Added as new tracing reason in Geth, available only on some chains
           */
          REASON_TX_INITIAL_BALANCE = 21,
          /**
           * REASON_TX_REFUNDS is the sum of all refunds which happened during the tx execution (e.g. storage slot being cleared)
           *  this generates an increase in gas. There is only one such gas change per transaction.
           *
           *  Added as new tracing reason in Geth, available only on some chains
           */
          REASON_TX_REFUNDS = 22,
          /**
           * REASON_TX_LEFT_OVER_RETURNED is the amount of gas left over at the end of transaction's execution that will be returned
           *  to the chain. This change will always be a negative change as we "drain" left over gas towards 0. If there was no gas
           *  left at the end of execution, no such even will be emitted. The returned gas's value in Wei is returned to caller.
           *  There is at most one of such gas change per transaction.
           *
           *  Added as new tracing reason in Geth, available only on some chains
           */
          REASON_TX_LEFT_OVER_RETURNED = 23,
          /**
           * REASON_CALL_INITIAL_BALANCE is the initial balance for the call which will be equal to the gasLimit of the call. There is only
           *  one such gas change per call.
           *
           *  Added as new tracing reason in Geth, available only on some chains
           */
          REASON_CALL_INITIAL_BALANCE = 24,
          /**
           * REASON_CALL_LEFT_OVER_RETURNED is the amount of gas left over that will be returned to the caller, this change will always
           *  be a negative change as we "drain" left over gas towards 0. If there was no gas left at the end of execution, no such even
           *  will be emitted.
           */
          REASON_CALL_LEFT_OVER_RETURNED = 25,
        } // GasChange_Reason
        /**
         * HeaderOnlyBlock is used to optimally unpack the [Block] structure (note the
         *  corresponding message number for the `header` field) while consuming less
         *  memory, when only the `header` is desired.
         *
         *  WARN: this is a client-side optimization pattern and should be moved in the
         *  consuming code.
         */
        export class HeaderOnlyBlock {
          public header: BlockHeader = new BlockHeader();

          // Decodes HeaderOnlyBlock from an ArrayBuffer
          static decode(buf: ArrayBuffer): HeaderOnlyBlock {
            return HeaderOnlyBlock.decodeDataView(new DataView(buf));
          }

          // Decodes HeaderOnlyBlock from a DataView
          static decodeDataView(view: DataView): HeaderOnlyBlock {
            const decoder = new __proto.Decoder(view);
            const obj = new HeaderOnlyBlock();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 5: {
                  const length = decoder.uint32();
                  obj.header = BlockHeader.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
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
          } // decode HeaderOnlyBlock

          public size(): u32 {
            let size: u32 = 0;

            if (this.header != null) {
              const f: BlockHeader = this.header as BlockHeader;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            return size;
          }

          // Encodes HeaderOnlyBlock to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes HeaderOnlyBlock to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.header != null) {
              const f = this.header as BlockHeader;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x2a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            return buf;
          } // encode HeaderOnlyBlock
        } // HeaderOnlyBlock

        /**
         * BlockWithRefs is a lightweight block, with traces and transactions
         *  purged from the `block` within, and only.  It is used in transports
         *  to pass block data around.
         */
        export class BlockWithRefs {
          public id: string = "";
          public block: Block = new Block();
          public transaction_trace_refs: TransactionRefs =
            new TransactionRefs();
          public irreversible: bool;

          // Decodes BlockWithRefs from an ArrayBuffer
          static decode(buf: ArrayBuffer): BlockWithRefs {
            return BlockWithRefs.decodeDataView(new DataView(buf));
          }

          // Decodes BlockWithRefs from a DataView
          static decodeDataView(view: DataView): BlockWithRefs {
            const decoder = new __proto.Decoder(view);
            const obj = new BlockWithRefs();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.id = decoder.string();
                  break;
                }
                case 2: {
                  const length = decoder.uint32();
                  obj.block = Block.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 3: {
                  const length = decoder.uint32();
                  obj.transaction_trace_refs = TransactionRefs.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 4: {
                  obj.irreversible = decoder.bool();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode BlockWithRefs

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.id.length > 0
                ? 1 + __proto.Sizer.varint64(this.id.length) + this.id.length
                : 0;

            if (this.block != null) {
              const f: Block = this.block as Block;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            if (this.transaction_trace_refs != null) {
              const f: TransactionRefs = this
                .transaction_trace_refs as TransactionRefs;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            size += this.irreversible == 0 ? 0 : 1 + 1;

            return size;
          }

          // Encodes BlockWithRefs to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes BlockWithRefs to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.id.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.id.length);
              encoder.string(this.id);
            }

            if (this.block != null) {
              const f = this.block as Block;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x12);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.transaction_trace_refs != null) {
              const f = this.transaction_trace_refs as TransactionRefs;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x1a);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.irreversible != 0) {
              encoder.uint32(0x20);
              encoder.bool(this.irreversible);
            }

            return buf;
          } // encode BlockWithRefs
        } // BlockWithRefs

        export class TransactionTraceWithBlockRef {
          public trace: TransactionTrace = new TransactionTrace();
          public block_ref: BlockRef = new BlockRef();

          // Decodes TransactionTraceWithBlockRef from an ArrayBuffer
          static decode(buf: ArrayBuffer): TransactionTraceWithBlockRef {
            return TransactionTraceWithBlockRef.decodeDataView(
              new DataView(buf)
            );
          }

          // Decodes TransactionTraceWithBlockRef from a DataView
          static decodeDataView(view: DataView): TransactionTraceWithBlockRef {
            const decoder = new __proto.Decoder(view);
            const obj = new TransactionTraceWithBlockRef();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  const length = decoder.uint32();
                  obj.trace = TransactionTrace.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
                    )
                  );
                  decoder.skip(length);

                  break;
                }
                case 2: {
                  const length = decoder.uint32();
                  obj.block_ref = BlockRef.decodeDataView(
                    new DataView(
                      decoder.view.buffer,
                      decoder.pos + decoder.view.byteOffset,
                      length
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
          } // decode TransactionTraceWithBlockRef

          public size(): u32 {
            let size: u32 = 0;

            if (this.trace != null) {
              const f: TransactionTrace = this.trace as TransactionTrace;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            if (this.block_ref != null) {
              const f: BlockRef = this.block_ref as BlockRef;
              const messageSize = f.size();

              if (messageSize > 0) {
                size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
              }
            }

            return size;
          }

          // Encodes TransactionTraceWithBlockRef to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes TransactionTraceWithBlockRef to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.trace != null) {
              const f = this.trace as TransactionTrace;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0xa);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            if (this.block_ref != null) {
              const f = this.block_ref as BlockRef;

              const messageSize = f.size();

              if (messageSize > 0) {
                encoder.uint32(0x12);
                encoder.uint32(messageSize);
                f.encodeU8Array(encoder);
              }
            }

            return buf;
          } // encode TransactionTraceWithBlockRef
        } // TransactionTraceWithBlockRef

        export class TransactionRefs {
          public hashes: Array<Array<u8>> = new Array<Array<u8>>();

          // Decodes TransactionRefs from an ArrayBuffer
          static decode(buf: ArrayBuffer): TransactionRefs {
            return TransactionRefs.decodeDataView(new DataView(buf));
          }

          // Decodes TransactionRefs from a DataView
          static decodeDataView(view: DataView): TransactionRefs {
            const decoder = new __proto.Decoder(view);
            const obj = new TransactionRefs();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.hashes.push(decoder.bytes());
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode TransactionRefs

          public size(): u32 {
            let size: u32 = 0;

            size += __size_bytes_repeated(this.hashes);

            return size;
          }

          // Encodes TransactionRefs to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes TransactionRefs to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.hashes.length > 0) {
              for (let n: i32 = 0; n < this.hashes.length; n++) {
                encoder.uint32(0xa);
                encoder.uint32(this.hashes[n].length);
                encoder.bytes(this.hashes[n]);
              }
            }

            return buf;
          } // encode TransactionRefs
        } // TransactionRefs

        export class BlockRef {
          public hash: Array<u8> = new Array<u8>();
          public number: u64;

          // Decodes BlockRef from an ArrayBuffer
          static decode(buf: ArrayBuffer): BlockRef {
            return BlockRef.decodeDataView(new DataView(buf));
          }

          // Decodes BlockRef from a DataView
          static decodeDataView(view: DataView): BlockRef {
            const decoder = new __proto.Decoder(view);
            const obj = new BlockRef();

            while (!decoder.eof()) {
              const tag = decoder.tag();
              const number = tag >>> 3;

              switch (number) {
                case 1: {
                  obj.hash = decoder.bytes();
                  break;
                }
                case 2: {
                  obj.number = decoder.uint64();
                  break;
                }

                default:
                  decoder.skipType(tag & 7);
                  break;
              }
            }
            return obj;
          } // decode BlockRef

          public size(): u32 {
            let size: u32 = 0;

            size +=
              this.hash.length > 0
                ? 1 +
                  __proto.Sizer.varint64(this.hash.length) +
                  this.hash.length
                : 0;
            size +=
              this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);

            return size;
          }

          // Encodes BlockRef to the ArrayBuffer
          encode(): ArrayBuffer {
            return changetype<ArrayBuffer>(
              StaticArray.fromArray<u8>(this.encodeU8Array())
            );
          }

          // Encodes BlockRef to the Array<u8>
          encodeU8Array(
            encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
          ): Array<u8> {
            const buf = encoder.buf;

            if (this.hash.length > 0) {
              encoder.uint32(0xa);
              encoder.uint32(this.hash.length);
              encoder.bytes(this.hash);
            }
            if (this.number != 0) {
              encoder.uint32(0x10);
              encoder.uint64(this.number);
            }

            return buf;
          } // encode BlockRef
        } // BlockRef
      } // v2
    } // type
    export namespace v2 {
      export enum TransactionTraceStatus {
        UNKNOWN = 0,
        SUCCEEDED = 1,
        FAILED = 2,
        REVERTED = 3,
      } // TransactionTraceStatus
      export enum CallType {
        UNSPECIFIED = 0,
        // direct? what's the name for `Call` alone?
        CALL = 1,
        CALLCODE = 2,
        DELEGATE = 3,
        STATIC = 4,
        // create2 ? any other form of calls?
        CREATE = 5,
      } // CallType
      export class Block {
        // Hash is the block's hash.
        public hash: Array<u8> = new Array<u8>();
        // Number is the block's height at which this block was mined.
        public number: u64;
        /**
         * Size is the size in bytes of the RLP encoding of the block according to Ethereum
         *  rules.
         * uint64 size = 4;
         *  Header contain's the block's header information like its parent hash, the merkel root hash
         *  and all other information the form a block.
         */
        public header: BlockHeader = new BlockHeader();
        /**
         * Uncles represents block produced with a valid solution but were not actually choosen
         *  as the canonical block for the given height so they are mostly "forked" blocks.
         *
         *  If the Block has been produced using the Proof of Stake consensus algorithm, this
         *  field will actually be always empty.
         */
        public uncles: Array<BlockHeader> = new Array<BlockHeader>();
        /**
         * TransactionTraces hold the execute trace of all the transactions that were executed
         *  in this block. In in there that you will find most of the Ethereum data model.
         *
         *  They are ordered by the order of execution of the transaction in the block.
         */
        public transaction_traces: Array<TransactionTrace> =
          new Array<TransactionTrace>();
        /**
         * BalanceChanges here is the array of ETH transfer that happened at the block level
         *  outside of the normal transaction flow of a block. The best example of this is mining
         *  reward for the block mined, the transfer of ETH to the miner happens outside the normal
         *  transaction flow of the chain and is recorded as a `BalanceChange` here since we cannot
         *  attached it to any transaction.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public balance_changes: Array<BalanceChange> =
          new Array<BalanceChange>();
        /**
         * DetailLevel affects the data available in this block.
         *
         *  EXTENDED describes the most complete block, with traces, balance changes, storage changes. It is extracted during the execution of the block.
         *  BASE describes a block that contains only the block header, transaction receipts and event logs: everything that can be extracted using the base JSON-RPC interface (https://ethereum.org/en/developers/docs/apis/json-rpc/#json-rpc-methods)
         *       Furthermore, the eth_getTransactionReceipt call has been avoided because it brings only minimal improvements at the cost of requiring an archive node or a full node with complete transaction index.
         */
        public detail_level: u32;
        /**
         * CodeChanges here is the array of smart code change that happened that happened at the block level
         *  outside of the normal transaction flow of a block. Some Ethereum's fork like BSC and Polygon
         *  has some capabilities to upgrade internal smart contracts used usually to track the validator
         *  list.
         *
         *  On hard fork, some procedure runs to upgrade the smart contract code to a new version. In those
         *  network, a `CodeChange` for each modified smart contract on upgrade would be present here. Note
         *  that this happen rarely, so the vast majority of block will have an empty list here.
         *  Only available in DetailLevel: EXTENDED
         */
        public code_changes: Array<CodeChange> = new Array<CodeChange>();
        /**
         * System calls are introduced in Cancun, along with blobs. They are executed outside of transactions but affect the state.
         *  Only available in DetailLevel: EXTENDED
         */
        public system_calls: Array<Call> = new Array<Call>();
        /**
         * Ver represents that data model version of the block, it is used internally by Firehose on Ethereum
         *  as a validation that we are reading the correct version.
         */
        public ver: i32;

        // Decodes Block from an ArrayBuffer
        static decode(buf: ArrayBuffer): Block {
          return Block.decodeDataView(new DataView(buf));
        }

        // Decodes Block from a DataView
        static decodeDataView(view: DataView): Block {
          const decoder = new __proto.Decoder(view);
          const obj = new Block();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 2: {
                obj.hash = decoder.bytes();
                break;
              }
              case 3: {
                obj.number = decoder.uint64();
                break;
              }
              case 5: {
                const length = decoder.uint32();
                obj.header = BlockHeader.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 6: {
                const length = decoder.uint32();
                obj.uncles.push(
                  BlockHeader.decodeDataView(
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
              case 10: {
                const length = decoder.uint32();
                obj.transaction_traces.push(
                  TransactionTrace.decodeDataView(
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
              case 11: {
                const length = decoder.uint32();
                obj.balance_changes.push(
                  BalanceChange.decodeDataView(
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
              case 12: {
                obj.detail_level = decoder.uint32();
                break;
              }
              case 20: {
                const length = decoder.uint32();
                obj.code_changes.push(
                  CodeChange.decodeDataView(
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
              case 21: {
                const length = decoder.uint32();
                obj.system_calls.push(
                  Call.decodeDataView(
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
              case 1: {
                obj.ver = decoder.int32();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Block

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.hash.length > 0
              ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;
          size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);

          if (this.header != null) {
            const f: BlockHeader = this.header as BlockHeader;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.uncles.length; n++) {
            const messageSize = this.uncles[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.transaction_traces.length; n++) {
            const messageSize = this.transaction_traces[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.balance_changes.length; n++) {
            const messageSize = this.balance_changes[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.detail_level == 0
              ? 0
              : 1 + __proto.Sizer.uint32(this.detail_level);

          for (let n: i32 = 0; n < this.code_changes.length; n++) {
            const messageSize = this.code_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.system_calls.length; n++) {
            const messageSize = this.system_calls[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.ver == 0 ? 0 : 1 + __proto.Sizer.int32(this.ver);

          return size;
        }

        // Encodes Block to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Block to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.hash.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.hash.length);
            encoder.bytes(this.hash);
          }
          if (this.number != 0) {
            encoder.uint32(0x18);
            encoder.uint64(this.number);
          }

          if (this.header != null) {
            const f = this.header as BlockHeader;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.uncles.length; n++) {
            const messageSize = this.uncles[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x32);
              encoder.uint32(messageSize);
              this.uncles[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.transaction_traces.length; n++) {
            const messageSize = this.transaction_traces[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x52);
              encoder.uint32(messageSize);
              this.transaction_traces[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.balance_changes.length; n++) {
            const messageSize = this.balance_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x5a);
              encoder.uint32(messageSize);
              this.balance_changes[n].encodeU8Array(encoder);
            }
          }

          if (this.detail_level != 0) {
            encoder.uint32(0x60);
            encoder.uint32(this.detail_level);
          }

          for (let n: i32 = 0; n < this.code_changes.length; n++) {
            const messageSize = this.code_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xa2);
              encoder.uint32(messageSize);
              this.code_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.system_calls.length; n++) {
            const messageSize = this.system_calls[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xaa);
              encoder.uint32(messageSize);
              this.system_calls[n].encodeU8Array(encoder);
            }
          }

          if (this.ver != 0) {
            encoder.uint32(0x8);
            encoder.int32(this.ver);
          }

          return buf;
        } // encode Block
      } // Block

      export enum Block_DetailLevel {
        DETAILLEVEL_EXTENDED = 0,
        // DETAILLEVEL_TRACE = 1; // TBD
        DETAILLEVEL_BASE = 2,
      } // Block_DetailLevel
      /**
       * BlockWithRefs is a lightweight block, with traces and transactions
       *  purged from the `block` within, and only.  It is used in transports
       *  to pass block data around.
       */
      export class BlockHeader {
        public parent_hash: Array<u8> = new Array<u8>();
        /**
         * Uncle hash of the block, some reference it as `sha3Uncles`, but `sha3`` is badly worded, so we prefer `uncle_hash`, also
         *  referred as `ommers` in EIP specification.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field will actually be constant and set to `0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347`.
         */
        public uncle_hash: Array<u8> = new Array<u8>();
        public coinbase: Array<u8> = new Array<u8>();
        public state_root: Array<u8> = new Array<u8>();
        public transactions_root: Array<u8> = new Array<u8>();
        public receipt_root: Array<u8> = new Array<u8>();
        public logs_bloom: Array<u8> = new Array<u8>();
        /**
         * Difficulty is the difficulty of the Proof of Work algorithm that was required to compute a solution.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field will actually be constant and set to `0x00`.
         */
        public difficulty: BigInt = new BigInt();
        /**
         * TotalDifficulty is the sum of all previous blocks difficulty including this block difficulty.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field will actually be constant and set to the terminal total difficulty
         *  that was required to transition to Proof of Stake algorithm, which varies per network. It is set to
         *  58 750 000 000 000 000 000 000 on Ethereum Mainnet and to 10 790 000 on Ethereum Testnet Goerli.
         */
        public total_difficulty: BigInt = new BigInt();
        public number: u64;
        public gas_limit: u64;
        public gas_used: u64;
        public timestamp: google.protobuf.Timestamp =
          new google.protobuf.Timestamp();
        /**
         * ExtraData is free-form bytes included in the block by the "miner". While on Yellow paper of
         *  Ethereum this value is maxed to 32 bytes, other consensus algorithm like Clique and some other
         *  forks are using bigger values to carry special consensus data.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field is strictly enforced to be <= 32 bytes.
         */
        public extra_data: Array<u8> = new Array<u8>();
        /**
         * MixHash is used to prove, when combined with the `nonce` that sufficient amount of computation has been
         *  achieved and that the solution found is valid.
         */
        public mix_hash: Array<u8> = new Array<u8>();
        /**
         * Nonce is used to prove, when combined with the `mix_hash` that sufficient amount of computation has been
         *  achieved and that the solution found is valid.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field will actually be constant and set to `0`.
         */
        public nonce: u64;
        /**
         * Hash is the hash of the block which is actually the computation:
         *
         *   Keccak256(rlp([
         *     parent_hash,
         *     uncle_hash,
         *     coinbase,
         *     state_root,
         *     transactions_root,
         *     receipt_root,
         *     logs_bloom,
         *     difficulty,
         *     number,
         *     gas_limit,
         *     gas_used,
         *     timestamp,
         *     extra_data,
         *     mix_hash,
         *     nonce,
         *     base_fee_per_gas (to be included only if London fork is active)
         *     withdrawals_root (to be included only if Shangai fork is active)
         *     blob_gas_used (to be included only if Cancun fork is active)
         *     excess_blob_gas (to be included only if Cancun fork is active)
         *     parent_beacon_root (to be included only if Cancun fork is active)
         *   ]))
         */
        public hash: Array<u8> = new Array<u8>();
        // Base fee per gas according to EIP-1559 (e.g. London Fork) rules, only set if London is present/active on the chain.
        public base_fee_per_gas: BigInt = new BigInt();
        /**
         * Withdrawals root hash according to EIP-4895 (e.g. Shangai Fork) rules, only set if Shangai is present/active on the chain.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public withdrawals_root: Array<u8> = new Array<u8>();
        // Only available in DetailLevel: EXTENDED
        public tx_dependency: Uint64NestedArray = new Uint64NestedArray();
        // BlobGasUsed was added by EIP-4844 and is ignored in legacy headers.
        public blob_gas_used: u64;
        // ExcessBlobGas was added by EIP-4844 and is ignored in legacy headers.
        public excess_blob_gas: u64;
        // ParentBeaconRoot was added by EIP-4788 and is ignored in legacy headers.
        public parent_beacon_root: Array<u8> = new Array<u8>();

        public ___blob_gas_used: string = "";
        public ___blob_gas_used_index: u8 = 0;

        public ___excess_blob_gas: string = "";
        public ___excess_blob_gas_index: u8 = 0;

        static readonly BLOB_GAS_USED_BLOB_GAS_USED_INDEX: u8 = 22;
        static readonly EXCESS_BLOB_GAS_EXCESS_BLOB_GAS_INDEX: u8 = 23;

        // Decodes BlockHeader from an ArrayBuffer
        static decode(buf: ArrayBuffer): BlockHeader {
          return BlockHeader.decodeDataView(new DataView(buf));
        }

        // Decodes BlockHeader from a DataView
        static decodeDataView(view: DataView): BlockHeader {
          const decoder = new __proto.Decoder(view);
          const obj = new BlockHeader();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.parent_hash = decoder.bytes();
                break;
              }
              case 2: {
                obj.uncle_hash = decoder.bytes();
                break;
              }
              case 3: {
                obj.coinbase = decoder.bytes();
                break;
              }
              case 4: {
                obj.state_root = decoder.bytes();
                break;
              }
              case 5: {
                obj.transactions_root = decoder.bytes();
                break;
              }
              case 6: {
                obj.receipt_root = decoder.bytes();
                break;
              }
              case 7: {
                obj.logs_bloom = decoder.bytes();
                break;
              }
              case 8: {
                const length = decoder.uint32();
                obj.difficulty = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 17: {
                const length = decoder.uint32();
                obj.total_difficulty = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 9: {
                obj.number = decoder.uint64();
                break;
              }
              case 10: {
                obj.gas_limit = decoder.uint64();
                break;
              }
              case 11: {
                obj.gas_used = decoder.uint64();
                break;
              }
              case 12: {
                const length = decoder.uint32();
                obj.timestamp = google.protobuf.Timestamp.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 13: {
                obj.extra_data = decoder.bytes();
                break;
              }
              case 14: {
                obj.mix_hash = decoder.bytes();
                break;
              }
              case 15: {
                obj.nonce = decoder.uint64();
                break;
              }
              case 16: {
                obj.hash = decoder.bytes();
                break;
              }
              case 18: {
                const length = decoder.uint32();
                obj.base_fee_per_gas = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 19: {
                obj.withdrawals_root = decoder.bytes();
                break;
              }
              case 20: {
                const length = decoder.uint32();
                obj.tx_dependency = Uint64NestedArray.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 22: {
                obj.blob_gas_used = decoder.uint64();
                obj.___blob_gas_used = "blob_gas_used";
                obj.___blob_gas_used_index = 22;
                break;
              }
              case 23: {
                obj.excess_blob_gas = decoder.uint64();
                obj.___excess_blob_gas = "excess_blob_gas";
                obj.___excess_blob_gas_index = 23;
                break;
              }
              case 24: {
                obj.parent_beacon_root = decoder.bytes();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BlockHeader

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.parent_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.parent_hash.length) +
                this.parent_hash.length
              : 0;
          size +=
            this.uncle_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.uncle_hash.length) +
                this.uncle_hash.length
              : 0;
          size +=
            this.coinbase.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.coinbase.length) +
                this.coinbase.length
              : 0;
          size +=
            this.state_root.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.state_root.length) +
                this.state_root.length
              : 0;
          size +=
            this.transactions_root.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.transactions_root.length) +
                this.transactions_root.length
              : 0;
          size +=
            this.receipt_root.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.receipt_root.length) +
                this.receipt_root.length
              : 0;
          size +=
            this.logs_bloom.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.logs_bloom.length) +
                this.logs_bloom.length
              : 0;

          if (this.difficulty != null) {
            const f: BigInt = this.difficulty as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.total_difficulty != null) {
            const f: BigInt = this.total_difficulty as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);
          size +=
            this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);
          size +=
            this.gas_used == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_used);

          if (this.timestamp != null) {
            const f: google.protobuf.Timestamp = this
              .timestamp as google.protobuf.Timestamp;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.extra_data.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.extra_data.length) +
                this.extra_data.length
              : 0;
          size +=
            this.mix_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.mix_hash.length) +
                this.mix_hash.length
              : 0;
          size += this.nonce == 0 ? 0 : 1 + __proto.Sizer.uint64(this.nonce);
          size +=
            this.hash.length > 0
              ? 2 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;

          if (this.base_fee_per_gas != null) {
            const f: BigInt = this.base_fee_per_gas as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.withdrawals_root.length > 0
              ? 2 +
                __proto.Sizer.varint64(this.withdrawals_root.length) +
                this.withdrawals_root.length
              : 0;

          if (this.tx_dependency != null) {
            const f: Uint64NestedArray = this
              .tx_dependency as Uint64NestedArray;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.blob_gas_used == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.blob_gas_used);
          size +=
            this.excess_blob_gas == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.excess_blob_gas);
          size +=
            this.parent_beacon_root.length > 0
              ? 2 +
                __proto.Sizer.varint64(this.parent_beacon_root.length) +
                this.parent_beacon_root.length
              : 0;

          return size;
        }

        // Encodes BlockHeader to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BlockHeader to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.parent_hash.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.parent_hash.length);
            encoder.bytes(this.parent_hash);
          }
          if (this.uncle_hash.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.uncle_hash.length);
            encoder.bytes(this.uncle_hash);
          }
          if (this.coinbase.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.coinbase.length);
            encoder.bytes(this.coinbase);
          }
          if (this.state_root.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.state_root.length);
            encoder.bytes(this.state_root);
          }
          if (this.transactions_root.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.transactions_root.length);
            encoder.bytes(this.transactions_root);
          }
          if (this.receipt_root.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.receipt_root.length);
            encoder.bytes(this.receipt_root);
          }
          if (this.logs_bloom.length > 0) {
            encoder.uint32(0x3a);
            encoder.uint32(this.logs_bloom.length);
            encoder.bytes(this.logs_bloom);
          }

          if (this.difficulty != null) {
            const f = this.difficulty as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x42);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.total_difficulty != null) {
            const f = this.total_difficulty as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x8a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.number != 0) {
            encoder.uint32(0x48);
            encoder.uint64(this.number);
          }
          if (this.gas_limit != 0) {
            encoder.uint32(0x50);
            encoder.uint64(this.gas_limit);
          }
          if (this.gas_used != 0) {
            encoder.uint32(0x58);
            encoder.uint64(this.gas_used);
          }

          if (this.timestamp != null) {
            const f = this.timestamp as google.protobuf.Timestamp;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x62);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.extra_data.length > 0) {
            encoder.uint32(0x6a);
            encoder.uint32(this.extra_data.length);
            encoder.bytes(this.extra_data);
          }
          if (this.mix_hash.length > 0) {
            encoder.uint32(0x72);
            encoder.uint32(this.mix_hash.length);
            encoder.bytes(this.mix_hash);
          }
          if (this.nonce != 0) {
            encoder.uint32(0x78);
            encoder.uint64(this.nonce);
          }
          if (this.hash.length > 0) {
            encoder.uint32(0x82);
            encoder.uint32(this.hash.length);
            encoder.bytes(this.hash);
          }

          if (this.base_fee_per_gas != null) {
            const f = this.base_fee_per_gas as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x92);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.withdrawals_root.length > 0) {
            encoder.uint32(0x9a);
            encoder.uint32(this.withdrawals_root.length);
            encoder.bytes(this.withdrawals_root);
          }

          if (this.tx_dependency != null) {
            const f = this.tx_dependency as Uint64NestedArray;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0xa2);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.blob_gas_used != 0) {
            encoder.uint32(0xb0);
            encoder.uint64(this.blob_gas_used);
          }
          if (this.excess_blob_gas != 0) {
            encoder.uint32(0xb8);
            encoder.uint64(this.excess_blob_gas);
          }
          if (this.parent_beacon_root.length > 0) {
            encoder.uint32(0xc2);
            encoder.uint32(this.parent_beacon_root.length);
            encoder.bytes(this.parent_beacon_root);
          }

          return buf;
        } // encode BlockHeader
      } // BlockHeader

      export class Uint64NestedArray {
        public val: Array<Uint64Array> = new Array<Uint64Array>();

        // Decodes Uint64NestedArray from an ArrayBuffer
        static decode(buf: ArrayBuffer): Uint64NestedArray {
          return Uint64NestedArray.decodeDataView(new DataView(buf));
        }

        // Decodes Uint64NestedArray from a DataView
        static decodeDataView(view: DataView): Uint64NestedArray {
          const decoder = new __proto.Decoder(view);
          const obj = new Uint64NestedArray();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const length = decoder.uint32();
                obj.val.push(
                  Uint64Array.decodeDataView(
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
        } // decode Uint64NestedArray

        public size(): u32 {
          let size: u32 = 0;

          for (let n: i32 = 0; n < this.val.length; n++) {
            const messageSize = this.val[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes Uint64NestedArray to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Uint64NestedArray to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          for (let n: i32 = 0; n < this.val.length; n++) {
            const messageSize = this.val[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xa);
              encoder.uint32(messageSize);
              this.val[n].encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode Uint64NestedArray
      } // Uint64NestedArray

      export class Uint64Array {
        public val: Array<u64> = new Array<u64>();

        // Decodes Uint64Array from an ArrayBuffer
        static decode(buf: ArrayBuffer): Uint64Array {
          return Uint64Array.decodeDataView(new DataView(buf));
        }

        // Decodes Uint64Array from a DataView
        static decodeDataView(view: DataView): Uint64Array {
          const decoder = new __proto.Decoder(view);
          const obj = new Uint64Array();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const endPos = decoder.pos + decoder.uint32();
                while (decoder.pos <= endPos) {
                  obj.val.push(decoder.uint64());
                }

                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Uint64Array

        public size(): u32 {
          let size: u32 = 0;

          if (this.val.length > 0) {
            const packedSize = __size_uint64_repeated_packed(this.val);
            if (packedSize > 0) {
              size += 1 + __proto.Sizer.varint64(packedSize) + packedSize;
            }
          }

          return size;
        }

        // Encodes Uint64Array to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Uint64Array to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.val.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(__size_uint64_repeated_packed(this.val));

            for (let n: i32 = 0; n < this.val.length; n++) {
              encoder.uint64(this.val[n]);
            }
          }

          return buf;
        } // encode Uint64Array
      } // Uint64Array

      export class BigInt {
        public bytes: Array<u8> = new Array<u8>();

        // Decodes BigInt from an ArrayBuffer
        static decode(buf: ArrayBuffer): BigInt {
          return BigInt.decodeDataView(new DataView(buf));
        }

        // Decodes BigInt from a DataView
        static decodeDataView(view: DataView): BigInt {
          const decoder = new __proto.Decoder(view);
          const obj = new BigInt();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.bytes = decoder.bytes();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BigInt

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.bytes.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.bytes.length) +
                this.bytes.length
              : 0;

          return size;
        }

        // Encodes BigInt to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BigInt to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.bytes.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.bytes.length);
            encoder.bytes(this.bytes);
          }

          return buf;
        } // encode BigInt
      } // BigInt

      /**
       * TransactionTrace is full trace of execution of the transaction when the
       *  it actually executed on chain.
       *
       *  It contains all the transaction details like `from`, `to`, `gas`, etc.
       *  as well as all the internal calls that were made during the transaction.
       *
       *  The `calls` vector contains Call objects which have balance changes, events
       *  storage changes, etc.
       *
       *  If ordering is important between elements, almost each message like `Log`,
       *  `Call`, `StorageChange`, etc. have an ordinal field that is represents "execution"
       *  order of the said element against all other elements in this block.
       *
       *  Due to how the call tree works doing "naively", looping through all calls then
       *  through a Call's element like `logs` while not yielding the elements in the order
       *  they were executed on chain. A log in call could have been done before or after
       *  another in another call depending on the actual call tree.
       *
       *  The `calls` are ordered by creation order and the call tree can be re-computing
       *  using fields found in `Call` object (parent/child relationship).
       *
       *  Another important thing to note is that even if a transaction succeed, some calls
       *  within it could have been reverted internally, if this is important to you, you must
       *  check the field `state_reverted` on the `Call` to determine if it was fully committed
       *  to the chain or not.
       */
      export class TransactionTrace {
        // consensus
        public to: Array<u8> = new Array<u8>();
        public nonce: u64;
        /**
         * GasPrice represents the effective price that has been paid for each gas unit of this transaction. Over time, the
         *  Ethereum rules changes regarding GasPrice field here. Before London fork, the GasPrice was always set to the
         *  fixed gas price. After London fork, this value has different meaning depending on the transaction type (see `Type` field).
         *
         *  In cases where `TransactionTrace.Type == TRX_TYPE_LEGACY || TRX_TYPE_ACCESS_LIST`, then GasPrice has the same meaning
         *  as before the London fork.
         *
         *  In cases where `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE`, then GasPrice is the effective gas price paid
         *  for the transaction which is equals to `BlockHeader.BaseFeePerGas + TransactionTrace.`
         */
        public gas_price: BigInt = new BigInt();
        /**
         * GasLimit is the maximum of gas unit the sender of the transaction is willing to consume when perform the EVM
         *  execution of the whole transaction
         */
        public gas_limit: u64;
        // Value is the amount of Ether transferred as part of this transaction.
        public value: BigInt = new BigInt();
        // Input data the transaction will receive for execution of EVM.
        public input: Array<u8> = new Array<u8>();
        // V is the recovery ID value for the signature Y point.
        public v: Array<u8> = new Array<u8>();
        // R is the signature's X point on the elliptic curve (32 bytes).
        public r: Array<u8> = new Array<u8>();
        // S is the signature's Y point on the elliptic curve (32 bytes).
        public s: Array<u8> = new Array<u8>();
        // GasUsed is the total amount of gas unit used for the whole execution of the transaction.
        public gas_used: u64;
        /**
         * Type represents the Ethereum transaction type, available only since EIP-2718 & EIP-2930 activation which happened on Berlin fork.
         *  The value is always set even for transaction before Berlin fork because those before the fork are still legacy transactions.
         */
        public type: u32;
        /**
         * AcccessList represents the storage access this transaction has agreed to do in which case those storage
         *  access cost less gas unit per access.
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_ACCESS_LIST || TRX_TYPE_DYNAMIC_FEE` which
         *  is possible only if Berlin (TRX_TYPE_ACCESS_LIST) nor London (TRX_TYPE_DYNAMIC_FEE) fork are active on the chain.
         */
        public access_list: Array<AccessTuple> = new Array<AccessTuple>();
        /**
         * MaxFeePerGas is the maximum fee per gas the user is willing to pay for the transaction gas used.
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE` which is possible only
         *  if Londong fork is active on the chain.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public max_fee_per_gas: BigInt = new BigInt();
        /**
         * MaxPriorityFeePerGas is priority fee per gas the user to pay in extra to the miner on top of the block's
         *  base fee.
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE` which is possible only
         *  if London fork is active on the chain.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public max_priority_fee_per_gas: BigInt = new BigInt();
        // meta
        public index: u32;
        public hash: Array<u8> = new Array<u8>();
        public from: Array<u8> = new Array<u8>();
        // Only available in DetailLevel: EXTENDED
        public return_data: Array<u8> = new Array<u8>();
        // Only available in DetailLevel: EXTENDED
        public public_key: Array<u8> = new Array<u8>();
        public begin_ordinal: u64;
        public end_ordinal: u64;
        /**
         * TransactionTraceStatus is the status of the transaction execution and will let you know if the transaction
         *  was successful or not.
         *
         *  A successful transaction has been recorded to the blockchain's state for calls in it that were successful.
         *  This means it's possible only a subset of the calls were properly recorded, refer to [calls[].state_reverted] field
         *  to determine which calls were reverted.
         *
         *  A quirks of the Ethereum protocol is that a transaction `FAILED` or `REVERTED` still affects the blockchain's
         *  state for **some** of the state changes. Indeed, in those cases, the transactions fees are still paid to the miner
         *  which means there is a balance change for the transaction's emitter (e.g. `from`) to pay the gas fees, an optional
         *  balance change for gas refunded to the transaction's emitter (e.g. `from`) and a balance change for the miner who
         *  received the transaction fees. There is also a nonce change for the transaction's emitter (e.g. `from`).
         *
         *  This means that to properly record the state changes for a transaction, you need to conditionally procees the
         *  transaction's status.
         *
         *  For a `SUCCEEDED` transaction, you iterate over the `calls` array and record the state changes for each call for
         *  which `state_reverted == false` (if a transaction succeeded, the call at #0 will always `state_reverted == false`
         *  because it aligns with the transaction).
         *
         *  For a `FAILED` or `REVERTED` transaction, you iterate over the root call (e.g. at #0, will always exist) for
         *  balance changes you process those where `reason` is either `REASON_GAS_BUY`, `REASON_GAS_REFUND` or
         *  `REASON_REWARD_TRANSACTION_FEE` and for nonce change, still on the root call, you pick the nonce change which the
         *  smallest ordinal (if more than one).
         */
        public status: u32;
        public receipt: TransactionReceipt = new TransactionReceipt();
        // Only available in DetailLevel: EXTENDED
        public calls: Array<Call> = new Array<Call>();
        /**
         * BlobGas is the amount of gas the transaction is going to pay for the blobs, this is a computed value
         *  equivalent to `self.blob_gas_fee_cap * len(self.blob_hashes)` and provided in the model for convenience.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_gas: u64;
        /**
         * BlobGasFeeCap is the maximum fee per data gas the user is willing to pay for the data gas used.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_gas_fee_cap: BigInt | null;
        /**
         * BlobHashes field represents a list of hash outputs from 'kzg_to_versioned_hash' which
         *  essentially is a version byte + the sha256 hash of the blob commitment (e.g.
         *  `BLOB_COMMITMENT_VERSION_KZG + sha256(commitment)[1:]`.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_hashes: Array<Array<u8>> = new Array<Array<u8>>();

        public ___blob_gas: string = "";
        public ___blob_gas_index: u8 = 0;

        public ___blob_gas_fee_cap: string = "";
        public ___blob_gas_fee_cap_index: u8 = 0;

        static readonly BLOB_GAS_BLOB_GAS_INDEX: u8 = 33;
        static readonly BLOB_GAS_FEE_CAP_BLOB_GAS_FEE_CAP_INDEX: u8 = 34;

        // Decodes TransactionTrace from an ArrayBuffer
        static decode(buf: ArrayBuffer): TransactionTrace {
          return TransactionTrace.decodeDataView(new DataView(buf));
        }

        // Decodes TransactionTrace from a DataView
        static decodeDataView(view: DataView): TransactionTrace {
          const decoder = new __proto.Decoder(view);
          const obj = new TransactionTrace();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.to = decoder.bytes();
                break;
              }
              case 2: {
                obj.nonce = decoder.uint64();
                break;
              }
              case 3: {
                const length = decoder.uint32();
                obj.gas_price = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 4: {
                obj.gas_limit = decoder.uint64();
                break;
              }
              case 5: {
                const length = decoder.uint32();
                obj.value = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 6: {
                obj.input = decoder.bytes();
                break;
              }
              case 7: {
                obj.v = decoder.bytes();
                break;
              }
              case 8: {
                obj.r = decoder.bytes();
                break;
              }
              case 9: {
                obj.s = decoder.bytes();
                break;
              }
              case 10: {
                obj.gas_used = decoder.uint64();
                break;
              }
              case 12: {
                obj.type = decoder.uint32();
                break;
              }
              case 14: {
                const length = decoder.uint32();
                obj.access_list.push(
                  AccessTuple.decodeDataView(
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
              case 11: {
                const length = decoder.uint32();
                obj.max_fee_per_gas = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 13: {
                const length = decoder.uint32();
                obj.max_priority_fee_per_gas = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 20: {
                obj.index = decoder.uint32();
                break;
              }
              case 21: {
                obj.hash = decoder.bytes();
                break;
              }
              case 22: {
                obj.from = decoder.bytes();
                break;
              }
              case 23: {
                obj.return_data = decoder.bytes();
                break;
              }
              case 24: {
                obj.public_key = decoder.bytes();
                break;
              }
              case 25: {
                obj.begin_ordinal = decoder.uint64();
                break;
              }
              case 26: {
                obj.end_ordinal = decoder.uint64();
                break;
              }
              case 30: {
                obj.status = decoder.uint32();
                break;
              }
              case 31: {
                const length = decoder.uint32();
                obj.receipt = TransactionReceipt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 32: {
                const length = decoder.uint32();
                obj.calls.push(
                  Call.decodeDataView(
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
              case 33: {
                obj.blob_gas = decoder.uint64();
                obj.___blob_gas = "blob_gas";
                obj.___blob_gas_index = 33;
                break;
              }
              case 34: {
                const length = decoder.uint32();
                obj.blob_gas_fee_cap = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                obj.___blob_gas_fee_cap = "blob_gas_fee_cap";
                obj.___blob_gas_fee_cap_index = 34;
                break;
              }
              case 35: {
                obj.blob_hashes.push(decoder.bytes());
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode TransactionTrace

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.to.length > 0
              ? 1 + __proto.Sizer.varint64(this.to.length) + this.to.length
              : 0;
          size += this.nonce == 0 ? 0 : 1 + __proto.Sizer.uint64(this.nonce);

          if (this.gas_price != null) {
            const f: BigInt = this.gas_price as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);

          if (this.value != null) {
            const f: BigInt = this.value as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.input.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.input.length) +
                this.input.length
              : 0;
          size +=
            this.v.length > 0
              ? 1 + __proto.Sizer.varint64(this.v.length) + this.v.length
              : 0;
          size +=
            this.r.length > 0
              ? 1 + __proto.Sizer.varint64(this.r.length) + this.r.length
              : 0;
          size +=
            this.s.length > 0
              ? 1 + __proto.Sizer.varint64(this.s.length) + this.s.length
              : 0;
          size +=
            this.gas_used == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_used);
          size += this.type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.type);

          for (let n: i32 = 0; n < this.access_list.length; n++) {
            const messageSize = this.access_list[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.max_fee_per_gas != null) {
            const f: BigInt = this.max_fee_per_gas as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.max_priority_fee_per_gas != null) {
            const f: BigInt = this.max_priority_fee_per_gas as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.index == 0 ? 0 : 2 + __proto.Sizer.uint32(this.index);
          size +=
            this.hash.length > 0
              ? 2 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;
          size +=
            this.from.length > 0
              ? 2 + __proto.Sizer.varint64(this.from.length) + this.from.length
              : 0;
          size +=
            this.return_data.length > 0
              ? 2 +
                __proto.Sizer.varint64(this.return_data.length) +
                this.return_data.length
              : 0;
          size +=
            this.public_key.length > 0
              ? 2 +
                __proto.Sizer.varint64(this.public_key.length) +
                this.public_key.length
              : 0;
          size +=
            this.begin_ordinal == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.begin_ordinal);
          size +=
            this.end_ordinal == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.end_ordinal);
          size += this.status == 0 ? 0 : 2 + __proto.Sizer.uint32(this.status);

          if (this.receipt != null) {
            const f: TransactionReceipt = this.receipt as TransactionReceipt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.calls.length; n++) {
            const messageSize = this.calls[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.blob_gas == 0 ? 0 : 2 + __proto.Sizer.uint64(this.blob_gas);

          if (this.blob_gas_fee_cap != null) {
            const f: BigInt = this.blob_gas_fee_cap as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += __size_bytes_repeated(this.blob_hashes);

          return size;
        }

        // Encodes TransactionTrace to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes TransactionTrace to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.to.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.to.length);
            encoder.bytes(this.to);
          }
          if (this.nonce != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.nonce);
          }

          if (this.gas_price != null) {
            const f = this.gas_price as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.gas_limit != 0) {
            encoder.uint32(0x20);
            encoder.uint64(this.gas_limit);
          }

          if (this.value != null) {
            const f = this.value as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.input.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.input.length);
            encoder.bytes(this.input);
          }
          if (this.v.length > 0) {
            encoder.uint32(0x3a);
            encoder.uint32(this.v.length);
            encoder.bytes(this.v);
          }
          if (this.r.length > 0) {
            encoder.uint32(0x42);
            encoder.uint32(this.r.length);
            encoder.bytes(this.r);
          }
          if (this.s.length > 0) {
            encoder.uint32(0x4a);
            encoder.uint32(this.s.length);
            encoder.bytes(this.s);
          }
          if (this.gas_used != 0) {
            encoder.uint32(0x50);
            encoder.uint64(this.gas_used);
          }
          if (this.type != 0) {
            encoder.uint32(0x60);
            encoder.uint32(this.type);
          }

          for (let n: i32 = 0; n < this.access_list.length; n++) {
            const messageSize = this.access_list[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x72);
              encoder.uint32(messageSize);
              this.access_list[n].encodeU8Array(encoder);
            }
          }

          if (this.max_fee_per_gas != null) {
            const f = this.max_fee_per_gas as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x5a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.max_priority_fee_per_gas != null) {
            const f = this.max_priority_fee_per_gas as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x6a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.index != 0) {
            encoder.uint32(0xa0);
            encoder.uint32(this.index);
          }
          if (this.hash.length > 0) {
            encoder.uint32(0xaa);
            encoder.uint32(this.hash.length);
            encoder.bytes(this.hash);
          }
          if (this.from.length > 0) {
            encoder.uint32(0xb2);
            encoder.uint32(this.from.length);
            encoder.bytes(this.from);
          }
          if (this.return_data.length > 0) {
            encoder.uint32(0xba);
            encoder.uint32(this.return_data.length);
            encoder.bytes(this.return_data);
          }
          if (this.public_key.length > 0) {
            encoder.uint32(0xc2);
            encoder.uint32(this.public_key.length);
            encoder.bytes(this.public_key);
          }
          if (this.begin_ordinal != 0) {
            encoder.uint32(0xc8);
            encoder.uint64(this.begin_ordinal);
          }
          if (this.end_ordinal != 0) {
            encoder.uint32(0xd0);
            encoder.uint64(this.end_ordinal);
          }
          if (this.status != 0) {
            encoder.uint32(0xf0);
            encoder.uint32(this.status);
          }

          if (this.receipt != null) {
            const f = this.receipt as TransactionReceipt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0xfa);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.calls.length; n++) {
            const messageSize = this.calls[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x102);
              encoder.uint32(messageSize);
              this.calls[n].encodeU8Array(encoder);
            }
          }

          if (this.blob_gas != 0) {
            encoder.uint32(0x108);
            encoder.uint64(this.blob_gas);
          }

          if (this.blob_gas_fee_cap != null) {
            const f = this.blob_gas_fee_cap as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x112);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.blob_hashes.length > 0) {
            for (let n: i32 = 0; n < this.blob_hashes.length; n++) {
              encoder.uint32(0x11a);
              encoder.uint32(this.blob_hashes[n].length);
              encoder.bytes(this.blob_hashes[n]);
            }
          }

          return buf;
        } // encode TransactionTrace
      } // TransactionTrace

      export enum TransactionTrace_Type {
        // All transactions that ever existed prior Berlin fork before EIP-2718 was implemented.
        TRX_TYPE_LEGACY = 0,
        /**
         * Transaction that specicy an access list of contract/storage_keys that is going to be used
         *  in this transaction.
         *
         *  Added in Berlin fork (EIP-2930).
         */
        TRX_TYPE_ACCESS_LIST = 1,
        /**
         * Transaction that specifis an access list just like TRX_TYPE_ACCESS_LIST but in addition defines the
         *  max base gas gee and max priority gas fee to pay for this transaction. Transaction's of those type are
         *  executed against EIP-1559 rules which dictates a dynamic gas cost based on the congestion of the network.
         */
        TRX_TYPE_DYNAMIC_FEE = 2,
        /**
         * Transaction which contain a large amount of data that cannot be accessed by EVM execution, but whose commitment
         *  can be accessed. The format is intended to be fully compatible with the format that will be used in full sharding.
         *
         *  Transaction that defines specifis an access list just like TRX_TYPE_ACCESS_LIST and enables dynamic fee just like
         *  TRX_TYPE_DYNAMIC_FEE but in addition defines the fields 'max_fee_per_data_gas' of type 'uint256' and the fields
         *  'blob_versioned_hashes' field represents a list of hash outputs from 'kzg_to_versioned_hash'.
         *
         *  Activated in Dencun
         */
        TRX_TYPE_BLOB = 3,
        // Arbitrum-specific transactions
        TRX_TYPE_ARBITRUM_DEPOSIT = 100,
        TRX_TYPE_ARBITRUM_UNSIGNED = 101,
        TRX_TYPE_ARBITRUM_CONTRACT = 102,
        TRX_TYPE_ARBITRUM_RETRY = 104,
        TRX_TYPE_ARBITRUM_SUBMIT_RETRYABLE = 105,
        TRX_TYPE_ARBITRUM_INTERNAL = 106,
        TRX_TYPE_ARBITRUM_LEGACY = 120,
      } // TransactionTrace_Type
      /**
       * AccessTuple represents a list of storage keys for a given contract's address and is used
       *  for AccessList construction.
       */
      export class AccessTuple {
        public address: Array<u8> = new Array<u8>();
        public storage_keys: Array<Array<u8>> = new Array<Array<u8>>();

        // Decodes AccessTuple from an ArrayBuffer
        static decode(buf: ArrayBuffer): AccessTuple {
          return AccessTuple.decodeDataView(new DataView(buf));
        }

        // Decodes AccessTuple from a DataView
        static decodeDataView(view: DataView): AccessTuple {
          const decoder = new __proto.Decoder(view);
          const obj = new AccessTuple();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.storage_keys.push(decoder.bytes());
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode AccessTuple

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          size += __size_bytes_repeated(this.storage_keys);

          return size;
        }

        // Encodes AccessTuple to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes AccessTuple to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }

          if (this.storage_keys.length > 0) {
            for (let n: i32 = 0; n < this.storage_keys.length; n++) {
              encoder.uint32(0x12);
              encoder.uint32(this.storage_keys[n].length);
              encoder.bytes(this.storage_keys[n]);
            }
          }

          return buf;
        } // encode AccessTuple
      } // AccessTuple

      export class TransactionReceipt {
        /**
         * State root is an intermediate state_root hash, computed in-between transactions to make
         *  **sure** you could build a proof and point to state in the middle of a block. Geth client
         *  uses `PostState + root + PostStateOrStatus`` while Parity used `status_code, root...`` this piles
         *  hardforks, see (read the EIPs first):
         *  - https://github.com/ethereum/EIPs/blob/master/EIPS/eip-658.md
         *
         *  Moreover, the notion of `Outcome`` in parity, which segregates the two concepts, which are
         *  stored in the same field `status_code`` can be computed based on such a hack of the `state_root`
         *  field, following `EIP-658`.
         *
         *  Before Byzantinium hard fork, this field is always empty.
         */
        public state_root: Array<u8> = new Array<u8>();
        public cumulative_gas_used: u64;
        public logs_bloom: Array<u8> = new Array<u8>();
        public logs: Array<Log> = new Array<Log>();
        /**
         * BlobGasUsed is the amount of blob gas that has been used within this transaction. At time
         *  of writing, this is equal to `self.blob_gas_fee_cap * len(self.blob_hashes)`.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_gas_used: u64;
        /**
         * BlobGasPrice is the amount to pay per blob item in the transaction.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_gas_price: BigInt | null;

        public ___blob_gas_used: string = "";
        public ___blob_gas_used_index: u8 = 0;

        public ___blob_gas_price: string = "";
        public ___blob_gas_price_index: u8 = 0;

        static readonly BLOB_GAS_USED_BLOB_GAS_USED_INDEX: u8 = 5;
        static readonly BLOB_GAS_PRICE_BLOB_GAS_PRICE_INDEX: u8 = 6;

        // Decodes TransactionReceipt from an ArrayBuffer
        static decode(buf: ArrayBuffer): TransactionReceipt {
          return TransactionReceipt.decodeDataView(new DataView(buf));
        }

        // Decodes TransactionReceipt from a DataView
        static decodeDataView(view: DataView): TransactionReceipt {
          const decoder = new __proto.Decoder(view);
          const obj = new TransactionReceipt();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.state_root = decoder.bytes();
                break;
              }
              case 2: {
                obj.cumulative_gas_used = decoder.uint64();
                break;
              }
              case 3: {
                obj.logs_bloom = decoder.bytes();
                break;
              }
              case 4: {
                const length = decoder.uint32();
                obj.logs.push(
                  Log.decodeDataView(
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
              case 5: {
                obj.blob_gas_used = decoder.uint64();
                obj.___blob_gas_used = "blob_gas_used";
                obj.___blob_gas_used_index = 5;
                break;
              }
              case 6: {
                const length = decoder.uint32();
                obj.blob_gas_price = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                obj.___blob_gas_price = "blob_gas_price";
                obj.___blob_gas_price_index = 6;
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode TransactionReceipt

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.state_root.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.state_root.length) +
                this.state_root.length
              : 0;
          size +=
            this.cumulative_gas_used == 0
              ? 0
              : 1 + __proto.Sizer.uint64(this.cumulative_gas_used);
          size +=
            this.logs_bloom.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.logs_bloom.length) +
                this.logs_bloom.length
              : 0;

          for (let n: i32 = 0; n < this.logs.length; n++) {
            const messageSize = this.logs[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.blob_gas_used == 0
              ? 0
              : 1 + __proto.Sizer.uint64(this.blob_gas_used);

          if (this.blob_gas_price != null) {
            const f: BigInt = this.blob_gas_price as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes TransactionReceipt to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes TransactionReceipt to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.state_root.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.state_root.length);
            encoder.bytes(this.state_root);
          }
          if (this.cumulative_gas_used != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.cumulative_gas_used);
          }
          if (this.logs_bloom.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.logs_bloom.length);
            encoder.bytes(this.logs_bloom);
          }

          for (let n: i32 = 0; n < this.logs.length; n++) {
            const messageSize = this.logs[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x22);
              encoder.uint32(messageSize);
              this.logs[n].encodeU8Array(encoder);
            }
          }

          if (this.blob_gas_used != 0) {
            encoder.uint32(0x28);
            encoder.uint64(this.blob_gas_used);
          }

          if (this.blob_gas_price != null) {
            const f = this.blob_gas_price as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x32);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode TransactionReceipt
      } // TransactionReceipt

      export class Log {
        public address: Array<u8> = new Array<u8>();
        public topics: Array<Array<u8>> = new Array<Array<u8>>();
        public data: Array<u8> = new Array<u8>();
        /**
         * Index is the index of the log relative to the transaction. This index
         *  is always populated regardless of the state revertion of the the call
         *  that emitted this log.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public index: u32;
        /**
         * BlockIndex represents the index of the log relative to the Block.
         *
         *  An **important** notice is that this field will be 0 when the call
         *  that emitted the log has been reverted by the chain.
         *
         *  Currently, there is two locations where a Log can be obtained:
         *  - block.transaction_traces[].receipt.logs[]
         *  - block.transaction_traces[].calls[].logs[]
         *
         *  In the `receipt` case, the logs will be populated only when the call
         *  that emitted them has not been reverted by the chain and when in this
         *  position, the `blockIndex` is always populated correctly.
         *
         *  In the case of `calls` case, for `call` where `stateReverted == true`,
         *  the `blockIndex` value will always be 0.
         */
        public blockIndex: u32;
        public ordinal: u64;

        // Decodes Log from an ArrayBuffer
        static decode(buf: ArrayBuffer): Log {
          return Log.decodeDataView(new DataView(buf));
        }

        // Decodes Log from a DataView
        static decodeDataView(view: DataView): Log {
          const decoder = new __proto.Decoder(view);
          const obj = new Log();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.topics.push(decoder.bytes());
                break;
              }
              case 3: {
                obj.data = decoder.bytes();
                break;
              }
              case 4: {
                obj.index = decoder.uint32();
                break;
              }
              case 6: {
                obj.blockIndex = decoder.uint32();
                break;
              }
              case 7: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Log

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          size += __size_bytes_repeated(this.topics);

          size +=
            this.data.length > 0
              ? 1 + __proto.Sizer.varint64(this.data.length) + this.data.length
              : 0;
          size += this.index == 0 ? 0 : 1 + __proto.Sizer.uint32(this.index);
          size +=
            this.blockIndex == 0
              ? 0
              : 1 + __proto.Sizer.uint32(this.blockIndex);
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes Log to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Log to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }

          if (this.topics.length > 0) {
            for (let n: i32 = 0; n < this.topics.length; n++) {
              encoder.uint32(0x12);
              encoder.uint32(this.topics[n].length);
              encoder.bytes(this.topics[n]);
            }
          }

          if (this.data.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.data.length);
            encoder.bytes(this.data);
          }
          if (this.index != 0) {
            encoder.uint32(0x20);
            encoder.uint32(this.index);
          }
          if (this.blockIndex != 0) {
            encoder.uint32(0x30);
            encoder.uint32(this.blockIndex);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x38);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode Log
      } // Log

      export class Call {
        public index: u32;
        public parent_index: u32;
        public depth: u32;
        public call_type: u32;
        public caller: Array<u8> = new Array<u8>();
        public address: Array<u8> = new Array<u8>();
        public value: BigInt = new BigInt();
        public gas_limit: u64;
        public gas_consumed: u64;
        public return_data: Array<u8> = new Array<u8>();
        public input: Array<u8> = new Array<u8>();
        public executed_code: bool;
        public suicide: bool;
        // hex representation of the hash -> preimage
        public keccak_preimages: Map<string, string> = new Map<
          string,
          string
        >();
        public storage_changes: Array<StorageChange> =
          new Array<StorageChange>();
        public balance_changes: Array<BalanceChange> =
          new Array<BalanceChange>();
        public nonce_changes: Array<NonceChange> = new Array<NonceChange>();
        public logs: Array<Log> = new Array<Log>();
        public code_changes: Array<CodeChange> = new Array<CodeChange>();
        public gas_changes: Array<GasChange> = new Array<GasChange>();
        /**
         * In Ethereum, a call can be either:
         *  - Successfull, execution passes without any problem encountered
         *  - Failed, execution failed, and remaining gas should be consumed
         *  - Reverted, execution failed, but only gas consumed so far is billed, remaining gas is refunded
         *
         *  When a call is either `failed` or `reverted`, the `status_failed` field
         *  below is set to `true`. If the status is `reverted`, then both `status_failed`
         *  and `status_reverted` are going to be set to `true`.
         */
        public status_failed: bool;
        public status_reverted: bool;
        /**
         * Populated when a call either failed or reverted, so when `status_failed == true`,
         *  see above for details about those flags.
         */
        public failure_reason: string = "";
        /**
         * This field represents wheter or not the state changes performed
         *  by this call were correctly recorded by the blockchain.
         *
         *  On Ethereum, a transaction can record state changes even if some
         *  of its inner nested calls failed. This is problematic however since
         *  a call will invalidate all its state changes as well as all state
         *  changes performed by its child call. This means that even if a call
         *  has a status of `SUCCESS`, the chain might have reverted all the state
         *  changes it performed.
         *
         *  ```text
         *    Trx 1
         *     Call #1 <Failed>
         *       Call #2 <Execution Success>
         *       Call #3 <Execution Success>
         *       |--- Failure here
         *     Call #4
         *  ```
         *
         *  In the transaction above, while Call #2 and Call #3 would have the
         *  status `EXECUTED`.
         *
         *  If you check all calls and check only `state_reverted` flag, you might be missing
         *  some balance changes and nonce changes. This is because when a full transaction fails
         *  in ethereum (e.g. `calls.all(x.state_reverted == true)`), there is still the transaction
         *  fee that are recorded to the chain.
         *
         *  Refer to [TransactionTrace#status] field for more details about the handling you must
         *  perform.
         */
        public state_reverted: bool;
        public begin_ordinal: u64;
        public end_ordinal: u64;
        public account_creations: Array<AccountCreation> =
          new Array<AccountCreation>();

        // Decodes Call from an ArrayBuffer
        static decode(buf: ArrayBuffer): Call {
          return Call.decodeDataView(new DataView(buf));
        }

        // Decodes Call from a DataView
        static decodeDataView(view: DataView): Call {
          const decoder = new __proto.Decoder(view);
          const obj = new Call();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.index = decoder.uint32();
                break;
              }
              case 2: {
                obj.parent_index = decoder.uint32();
                break;
              }
              case 3: {
                obj.depth = decoder.uint32();
                break;
              }
              case 4: {
                obj.call_type = decoder.uint32();
                break;
              }
              case 5: {
                obj.caller = decoder.bytes();
                break;
              }
              case 6: {
                obj.address = decoder.bytes();
                break;
              }
              case 7: {
                const length = decoder.uint32();
                obj.value = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 8: {
                obj.gas_limit = decoder.uint64();
                break;
              }
              case 9: {
                obj.gas_consumed = decoder.uint64();
                break;
              }
              case 13: {
                obj.return_data = decoder.bytes();
                break;
              }
              case 14: {
                obj.input = decoder.bytes();
                break;
              }
              case 15: {
                obj.executed_code = decoder.bool();
                break;
              }
              case 16: {
                obj.suicide = decoder.bool();
                break;
              }
              case 20: {
                const length = decoder.uint32();
                __decodeMap_string_string(
                  decoder,
                  length,
                  obj.keccak_preimages
                );
                decoder.skip(length);

                break;
              }
              case 21: {
                const length = decoder.uint32();
                obj.storage_changes.push(
                  StorageChange.decodeDataView(
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
              case 22: {
                const length = decoder.uint32();
                obj.balance_changes.push(
                  BalanceChange.decodeDataView(
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
              case 24: {
                const length = decoder.uint32();
                obj.nonce_changes.push(
                  NonceChange.decodeDataView(
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
              case 25: {
                const length = decoder.uint32();
                obj.logs.push(
                  Log.decodeDataView(
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
              case 26: {
                const length = decoder.uint32();
                obj.code_changes.push(
                  CodeChange.decodeDataView(
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
              case 28: {
                const length = decoder.uint32();
                obj.gas_changes.push(
                  GasChange.decodeDataView(
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
              case 10: {
                obj.status_failed = decoder.bool();
                break;
              }
              case 12: {
                obj.status_reverted = decoder.bool();
                break;
              }
              case 11: {
                obj.failure_reason = decoder.string();
                break;
              }
              case 30: {
                obj.state_reverted = decoder.bool();
                break;
              }
              case 31: {
                obj.begin_ordinal = decoder.uint64();
                break;
              }
              case 32: {
                obj.end_ordinal = decoder.uint64();
                break;
              }
              case 33: {
                const length = decoder.uint32();
                obj.account_creations.push(
                  AccountCreation.decodeDataView(
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
        } // decode Call

        public size(): u32 {
          let size: u32 = 0;

          size += this.index == 0 ? 0 : 1 + __proto.Sizer.uint32(this.index);
          size +=
            this.parent_index == 0
              ? 0
              : 1 + __proto.Sizer.uint32(this.parent_index);
          size += this.depth == 0 ? 0 : 1 + __proto.Sizer.uint32(this.depth);
          size +=
            this.call_type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.call_type);
          size +=
            this.caller.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.caller.length) +
                this.caller.length
              : 0;
          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          if (this.value != null) {
            const f: BigInt = this.value as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);
          size +=
            this.gas_consumed == 0
              ? 0
              : 1 + __proto.Sizer.uint64(this.gas_consumed);
          size +=
            this.return_data.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.return_data.length) +
                this.return_data.length
              : 0;
          size +=
            this.input.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.input.length) +
                this.input.length
              : 0;
          size += this.executed_code == 0 ? 0 : 1 + 1;
          size += this.suicide == 0 ? 0 : 2 + 1;

          if (this.keccak_preimages.size > 0) {
            const keys = this.keccak_preimages.keys();

            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              const value = this.keccak_preimages.get(key);
              const itemSize = __sizeMapEntry_string_string(key, value);
              if (itemSize > 0) {
                size += 2 + __proto.Sizer.varint64(itemSize) + itemSize;
              }
            }
          }

          for (let n: i32 = 0; n < this.storage_changes.length; n++) {
            const messageSize = this.storage_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.balance_changes.length; n++) {
            const messageSize = this.balance_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.nonce_changes.length; n++) {
            const messageSize = this.nonce_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.logs.length; n++) {
            const messageSize = this.logs[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.code_changes.length; n++) {
            const messageSize = this.code_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.gas_changes.length; n++) {
            const messageSize = this.gas_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.status_failed == 0 ? 0 : 1 + 1;
          size += this.status_reverted == 0 ? 0 : 1 + 1;
          size +=
            this.failure_reason.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.failure_reason.length) +
                this.failure_reason.length
              : 0;
          size += this.state_reverted == 0 ? 0 : 2 + 1;
          size +=
            this.begin_ordinal == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.begin_ordinal);
          size +=
            this.end_ordinal == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.end_ordinal);

          for (let n: i32 = 0; n < this.account_creations.length; n++) {
            const messageSize = this.account_creations[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes Call to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Call to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.index != 0) {
            encoder.uint32(0x8);
            encoder.uint32(this.index);
          }
          if (this.parent_index != 0) {
            encoder.uint32(0x10);
            encoder.uint32(this.parent_index);
          }
          if (this.depth != 0) {
            encoder.uint32(0x18);
            encoder.uint32(this.depth);
          }
          if (this.call_type != 0) {
            encoder.uint32(0x20);
            encoder.uint32(this.call_type);
          }
          if (this.caller.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.caller.length);
            encoder.bytes(this.caller);
          }
          if (this.address.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }

          if (this.value != null) {
            const f = this.value as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x3a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.gas_limit != 0) {
            encoder.uint32(0x40);
            encoder.uint64(this.gas_limit);
          }
          if (this.gas_consumed != 0) {
            encoder.uint32(0x48);
            encoder.uint64(this.gas_consumed);
          }
          if (this.return_data.length > 0) {
            encoder.uint32(0x6a);
            encoder.uint32(this.return_data.length);
            encoder.bytes(this.return_data);
          }
          if (this.input.length > 0) {
            encoder.uint32(0x72);
            encoder.uint32(this.input.length);
            encoder.bytes(this.input);
          }
          if (this.executed_code != 0) {
            encoder.uint32(0x78);
            encoder.bool(this.executed_code);
          }
          if (this.suicide != 0) {
            encoder.uint32(0x80);
            encoder.bool(this.suicide);
          }

          if (this.keccak_preimages.size > 0) {
            const keys = this.keccak_preimages.keys();
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              const value = this.keccak_preimages.get(key);
              const size = __sizeMapEntry_string_string(key, value);
              if (size > 0) {
                encoder.uint32(0xa2);
                encoder.uint32(size);
                if (key.length > 0) {
                  encoder.uint32(0xa);
                  encoder.uint32(key.length);
                  encoder.string(key);
                }
                if (value.length > 0) {
                  encoder.uint32(0x12);
                  encoder.uint32(value.length);
                  encoder.string(value);
                }
              }
            }
          }

          for (let n: i32 = 0; n < this.storage_changes.length; n++) {
            const messageSize = this.storage_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xaa);
              encoder.uint32(messageSize);
              this.storage_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.balance_changes.length; n++) {
            const messageSize = this.balance_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xb2);
              encoder.uint32(messageSize);
              this.balance_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.nonce_changes.length; n++) {
            const messageSize = this.nonce_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xc2);
              encoder.uint32(messageSize);
              this.nonce_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.logs.length; n++) {
            const messageSize = this.logs[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xca);
              encoder.uint32(messageSize);
              this.logs[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.code_changes.length; n++) {
            const messageSize = this.code_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xd2);
              encoder.uint32(messageSize);
              this.code_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.gas_changes.length; n++) {
            const messageSize = this.gas_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xe2);
              encoder.uint32(messageSize);
              this.gas_changes[n].encodeU8Array(encoder);
            }
          }

          if (this.status_failed != 0) {
            encoder.uint32(0x50);
            encoder.bool(this.status_failed);
          }
          if (this.status_reverted != 0) {
            encoder.uint32(0x60);
            encoder.bool(this.status_reverted);
          }
          if (this.failure_reason.length > 0) {
            encoder.uint32(0x5a);
            encoder.uint32(this.failure_reason.length);
            encoder.string(this.failure_reason);
          }
          if (this.state_reverted != 0) {
            encoder.uint32(0xf0);
            encoder.bool(this.state_reverted);
          }
          if (this.begin_ordinal != 0) {
            encoder.uint32(0xf8);
            encoder.uint64(this.begin_ordinal);
          }
          if (this.end_ordinal != 0) {
            encoder.uint32(0x100);
            encoder.uint64(this.end_ordinal);
          }

          for (let n: i32 = 0; n < this.account_creations.length; n++) {
            const messageSize = this.account_creations[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x10a);
              encoder.uint32(messageSize);
              this.account_creations[n].encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode Call
      } // Call

      export class StorageChange {
        public address: Array<u8> = new Array<u8>();
        public key: Array<u8> = new Array<u8>();
        public old_value: Array<u8> = new Array<u8>();
        public new_value: Array<u8> = new Array<u8>();
        public ordinal: u64;

        // Decodes StorageChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): StorageChange {
          return StorageChange.decodeDataView(new DataView(buf));
        }

        // Decodes StorageChange from a DataView
        static decodeDataView(view: DataView): StorageChange {
          const decoder = new __proto.Decoder(view);
          const obj = new StorageChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.key = decoder.bytes();
                break;
              }
              case 3: {
                obj.old_value = decoder.bytes();
                break;
              }
              case 4: {
                obj.new_value = decoder.bytes();
                break;
              }
              case 5: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode StorageChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;
          size +=
            this.key.length > 0
              ? 1 + __proto.Sizer.varint64(this.key.length) + this.key.length
              : 0;
          size +=
            this.old_value.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.old_value.length) +
                this.old_value.length
              : 0;
          size +=
            this.new_value.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.new_value.length) +
                this.new_value.length
              : 0;
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes StorageChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes StorageChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }
          if (this.key.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.key.length);
            encoder.bytes(this.key);
          }
          if (this.old_value.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.old_value.length);
            encoder.bytes(this.old_value);
          }
          if (this.new_value.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.new_value.length);
            encoder.bytes(this.new_value);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x28);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode StorageChange
      } // StorageChange

      export class BalanceChange {
        public address: Array<u8> = new Array<u8>();
        public old_value: BigInt = new BigInt();
        public new_value: BigInt = new BigInt();
        public reason: u32;
        public ordinal: u64;

        // Decodes BalanceChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): BalanceChange {
          return BalanceChange.decodeDataView(new DataView(buf));
        }

        // Decodes BalanceChange from a DataView
        static decodeDataView(view: DataView): BalanceChange {
          const decoder = new __proto.Decoder(view);
          const obj = new BalanceChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                const length = decoder.uint32();
                obj.old_value = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 3: {
                const length = decoder.uint32();
                obj.new_value = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 4: {
                obj.reason = decoder.uint32();
                break;
              }
              case 5: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BalanceChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          if (this.old_value != null) {
            const f: BigInt = this.old_value as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.new_value != null) {
            const f: BigInt = this.new_value as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.reason == 0 ? 0 : 1 + __proto.Sizer.uint32(this.reason);
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes BalanceChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BalanceChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }

          if (this.old_value != null) {
            const f = this.old_value as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x12);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.new_value != null) {
            const f = this.new_value as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.reason != 0) {
            encoder.uint32(0x20);
            encoder.uint32(this.reason);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x28);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode BalanceChange
      } // BalanceChange

      /**
       * Obtain all balanche change reasons under deep mind repository:
       *
       *  ```shell
       *  ack -ho 'BalanceChangeReason\(".*"\)' | grep -Eo '".*"' | sort | uniq
       *  ```
       */
      export enum BalanceChange_Reason {
        REASON_UNKNOWN = 0,
        REASON_REWARD_MINE_UNCLE = 1,
        REASON_REWARD_MINE_BLOCK = 2,
        REASON_DAO_REFUND_CONTRACT = 3,
        REASON_DAO_ADJUST_BALANCE = 4,
        REASON_TRANSFER = 5,
        REASON_GENESIS_BALANCE = 6,
        REASON_GAS_BUY = 7,
        REASON_REWARD_TRANSACTION_FEE = 8,
        REASON_REWARD_FEE_RESET = 14,
        REASON_GAS_REFUND = 9,
        REASON_TOUCH_ACCOUNT = 10,
        REASON_SUICIDE_REFUND = 11,
        REASON_SUICIDE_WITHDRAW = 13,
        REASON_CALL_BALANCE_OVERRIDE = 12,
        // Used on chain(s) where some Ether burning happens
        REASON_BURN = 15,
        REASON_WITHDRAWAL = 16,
      } // BalanceChange_Reason
      export class NonceChange {
        public address: Array<u8> = new Array<u8>();
        public old_value: u64;
        public new_value: u64;
        public ordinal: u64;

        // Decodes NonceChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): NonceChange {
          return NonceChange.decodeDataView(new DataView(buf));
        }

        // Decodes NonceChange from a DataView
        static decodeDataView(view: DataView): NonceChange {
          const decoder = new __proto.Decoder(view);
          const obj = new NonceChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.old_value = decoder.uint64();
                break;
              }
              case 3: {
                obj.new_value = decoder.uint64();
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
        } // decode NonceChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;
          size +=
            this.old_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.old_value);
          size +=
            this.new_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.new_value);
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes NonceChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes NonceChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }
          if (this.old_value != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.old_value);
          }
          if (this.new_value != 0) {
            encoder.uint32(0x18);
            encoder.uint64(this.new_value);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x20);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode NonceChange
      } // NonceChange

      export class AccountCreation {
        public account: Array<u8> = new Array<u8>();
        public ordinal: u64;

        // Decodes AccountCreation from an ArrayBuffer
        static decode(buf: ArrayBuffer): AccountCreation {
          return AccountCreation.decodeDataView(new DataView(buf));
        }

        // Decodes AccountCreation from a DataView
        static decodeDataView(view: DataView): AccountCreation {
          const decoder = new __proto.Decoder(view);
          const obj = new AccountCreation();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.account = decoder.bytes();
                break;
              }
              case 2: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode AccountCreation

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.account.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.account.length) +
                this.account.length
              : 0;
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes AccountCreation to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes AccountCreation to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.account.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.account.length);
            encoder.bytes(this.account);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode AccountCreation
      } // AccountCreation

      export class CodeChange {
        public address: Array<u8> = new Array<u8>();
        public old_hash: Array<u8> = new Array<u8>();
        public old_code: Array<u8> = new Array<u8>();
        public new_hash: Array<u8> = new Array<u8>();
        public new_code: Array<u8> = new Array<u8>();
        public ordinal: u64;

        // Decodes CodeChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): CodeChange {
          return CodeChange.decodeDataView(new DataView(buf));
        }

        // Decodes CodeChange from a DataView
        static decodeDataView(view: DataView): CodeChange {
          const decoder = new __proto.Decoder(view);
          const obj = new CodeChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.old_hash = decoder.bytes();
                break;
              }
              case 3: {
                obj.old_code = decoder.bytes();
                break;
              }
              case 4: {
                obj.new_hash = decoder.bytes();
                break;
              }
              case 5: {
                obj.new_code = decoder.bytes();
                break;
              }
              case 6: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode CodeChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;
          size +=
            this.old_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.old_hash.length) +
                this.old_hash.length
              : 0;
          size +=
            this.old_code.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.old_code.length) +
                this.old_code.length
              : 0;
          size +=
            this.new_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.new_hash.length) +
                this.new_hash.length
              : 0;
          size +=
            this.new_code.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.new_code.length) +
                this.new_code.length
              : 0;
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes CodeChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes CodeChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }
          if (this.old_hash.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.old_hash.length);
            encoder.bytes(this.old_hash);
          }
          if (this.old_code.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.old_code.length);
            encoder.bytes(this.old_code);
          }
          if (this.new_hash.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.new_hash.length);
            encoder.bytes(this.new_hash);
          }
          if (this.new_code.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.new_code.length);
            encoder.bytes(this.new_code);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x30);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode CodeChange
      } // CodeChange

      /**
       * The gas change model represents the reason why some gas cost has occurred.
       *  The gas is computed per actual op codes. Doing them completely might prove
       *  overwhelming in most cases.
       *
       *  Hence, we only index some of them, those that are costy like all the calls
       *  one, log events, return data, etc.
       */
      export class GasChange {
        public old_value: u64;
        public new_value: u64;
        public reason: u32;
        public ordinal: u64;

        // Decodes GasChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): GasChange {
          return GasChange.decodeDataView(new DataView(buf));
        }

        // Decodes GasChange from a DataView
        static decodeDataView(view: DataView): GasChange {
          const decoder = new __proto.Decoder(view);
          const obj = new GasChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.old_value = decoder.uint64();
                break;
              }
              case 2: {
                obj.new_value = decoder.uint64();
                break;
              }
              case 3: {
                obj.reason = decoder.uint32();
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
        } // decode GasChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.old_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.old_value);
          size +=
            this.new_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.new_value);
          size += this.reason == 0 ? 0 : 1 + __proto.Sizer.uint32(this.reason);
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes GasChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes GasChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.old_value != 0) {
            encoder.uint32(0x8);
            encoder.uint64(this.old_value);
          }
          if (this.new_value != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.new_value);
          }
          if (this.reason != 0) {
            encoder.uint32(0x18);
            encoder.uint32(this.reason);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x20);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode GasChange
      } // GasChange

      /**
       * Obtain all gas change reasons under deep mind repository:
       *
       *  ```shell
       *  ack -ho 'GasChangeReason\(".*"\)' | grep -Eo '".*"' | sort | uniq
       *  ```
       */
      export enum GasChange_Reason {
        REASON_UNKNOWN = 0,
        // REASON_CALL is the amount of gas that will be charged for a 'CALL' opcode executed by the EVM
        REASON_CALL = 1,
        // REASON_CALL_CODE is the amount of gas that will be charged for a 'CALLCODE' opcode executed by the EVM
        REASON_CALL_CODE = 2,
        // REASON_CALL_DATA_COPY is the amount of gas that will be charged for a 'CALLDATACOPY' opcode executed by the EVM
        REASON_CALL_DATA_COPY = 3,
        // REASON_CODE_COPY is the amount of gas that will be charged for a 'CALLDATACOPY' opcode executed by the EVM
        REASON_CODE_COPY = 4,
        // REASON_CODE_STORAGE is the amount of gas that will be charged for code storage
        REASON_CODE_STORAGE = 5,
        /**
         * REASON_CONTRACT_CREATION is the amount of gas that will be charged for a 'CREATE' opcode executed by the EVM and for the gas
         *  burned for a CREATE, today controlled by EIP150 rules
         */
        REASON_CONTRACT_CREATION = 6,
        /**
         * REASON_CONTRACT_CREATION2 is the amount of gas that will be charged for a 'CREATE2' opcode executed by the EVM and for the gas
         *  burned for a CREATE2, today controlled by EIP150 rules
         */
        REASON_CONTRACT_CREATION2 = 7,
        // REASON_DELEGATE_CALL is the amount of gas that will be charged for a 'DELEGATECALL' opcode executed by the EVM
        REASON_DELEGATE_CALL = 8,
        // REASON_EVENT_LOG is the amount of gas that will be charged for a 'LOG<N>' opcode executed by the EVM
        REASON_EVENT_LOG = 9,
        // REASON_EXT_CODE_COPY is the amount of gas that will be charged for a 'LOG<N>' opcode executed by the EVM
        REASON_EXT_CODE_COPY = 10,
        // REASON_FAILED_EXECUTION is the burning of the remaining gas when the execution failed without a revert
        REASON_FAILED_EXECUTION = 11,
        /**
         * REASON_INTRINSIC_GAS is the amount of gas that will be charged for the intrinsic cost of the transaction, there is
         *  always exactly one of those per transaction
         */
        REASON_INTRINSIC_GAS = 12,
        // GasChangePrecompiledContract is the amount of gas that will be charged for a precompiled contract execution
        REASON_PRECOMPILED_CONTRACT = 13,
        /**
         * REASON_REFUND_AFTER_EXECUTION is the amount of gas that will be refunded to the caller after the execution of the call,
         *  if there is left over at the end of execution
         */
        REASON_REFUND_AFTER_EXECUTION = 14,
        // REASON_RETURN is the amount of gas that will be charged for a 'RETURN' opcode executed by the EVM
        REASON_RETURN = 15,
        // REASON_RETURN_DATA_COPY is the amount of gas that will be charged for a 'RETURNDATACOPY' opcode executed by the EVM
        REASON_RETURN_DATA_COPY = 16,
        // REASON_REVERT is the amount of gas that will be charged for a 'REVERT' opcode executed by the EVM
        REASON_REVERT = 17,
        // REASON_SELF_DESTRUCT is the amount of gas that will be charged for a 'SELFDESTRUCT' opcode executed by the EVM
        REASON_SELF_DESTRUCT = 18,
        // REASON_STATIC_CALL is the amount of gas that will be charged for a 'STATICALL' opcode executed by the EVM
        REASON_STATIC_CALL = 19,
        /**
         * REASON_STATE_COLD_ACCESS is the amount of gas that will be charged for a cold storage access as controlled by EIP2929 rules
         *
         *  Added in Berlin fork (Geth 1.10+)
         */
        REASON_STATE_COLD_ACCESS = 20,
        /**
         * REASON_TX_INITIAL_BALANCE is the initial balance for the call which will be equal to the gasLimit of the call
         *
         *  Added as new tracing reason in Geth, available only on some chains
         */
        REASON_TX_INITIAL_BALANCE = 21,
        /**
         * REASON_TX_REFUNDS is the sum of all refunds which happened during the tx execution (e.g. storage slot being cleared)
         *  this generates an increase in gas. There is only one such gas change per transaction.
         *
         *  Added as new tracing reason in Geth, available only on some chains
         */
        REASON_TX_REFUNDS = 22,
        /**
         * REASON_TX_LEFT_OVER_RETURNED is the amount of gas left over at the end of transaction's execution that will be returned
         *  to the chain. This change will always be a negative change as we "drain" left over gas towards 0. If there was no gas
         *  left at the end of execution, no such even will be emitted. The returned gas's value in Wei is returned to caller.
         *  There is at most one of such gas change per transaction.
         *
         *  Added as new tracing reason in Geth, available only on some chains
         */
        REASON_TX_LEFT_OVER_RETURNED = 23,
        /**
         * REASON_CALL_INITIAL_BALANCE is the initial balance for the call which will be equal to the gasLimit of the call. There is only
         *  one such gas change per call.
         *
         *  Added as new tracing reason in Geth, available only on some chains
         */
        REASON_CALL_INITIAL_BALANCE = 24,
        /**
         * REASON_CALL_LEFT_OVER_RETURNED is the amount of gas left over that will be returned to the caller, this change will always
         *  be a negative change as we "drain" left over gas towards 0. If there was no gas left at the end of execution, no such even
         *  will be emitted.
         */
        REASON_CALL_LEFT_OVER_RETURNED = 25,
      } // GasChange_Reason
      /**
       * HeaderOnlyBlock is used to optimally unpack the [Block] structure (note the
       *  corresponding message number for the `header` field) while consuming less
       *  memory, when only the `header` is desired.
       *
       *  WARN: this is a client-side optimization pattern and should be moved in the
       *  consuming code.
       */
      export class HeaderOnlyBlock {
        public header: BlockHeader = new BlockHeader();

        // Decodes HeaderOnlyBlock from an ArrayBuffer
        static decode(buf: ArrayBuffer): HeaderOnlyBlock {
          return HeaderOnlyBlock.decodeDataView(new DataView(buf));
        }

        // Decodes HeaderOnlyBlock from a DataView
        static decodeDataView(view: DataView): HeaderOnlyBlock {
          const decoder = new __proto.Decoder(view);
          const obj = new HeaderOnlyBlock();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 5: {
                const length = decoder.uint32();
                obj.header = BlockHeader.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
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
        } // decode HeaderOnlyBlock

        public size(): u32 {
          let size: u32 = 0;

          if (this.header != null) {
            const f: BlockHeader = this.header as BlockHeader;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes HeaderOnlyBlock to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes HeaderOnlyBlock to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.header != null) {
            const f = this.header as BlockHeader;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode HeaderOnlyBlock
      } // HeaderOnlyBlock

      /**
       * BlockWithRefs is a lightweight block, with traces and transactions
       *  purged from the `block` within, and only.  It is used in transports
       *  to pass block data around.
       */
      export class BlockWithRefs {
        public id: string = "";
        public block: Block = new Block();
        public transaction_trace_refs: TransactionRefs = new TransactionRefs();
        public irreversible: bool;

        // Decodes BlockWithRefs from an ArrayBuffer
        static decode(buf: ArrayBuffer): BlockWithRefs {
          return BlockWithRefs.decodeDataView(new DataView(buf));
        }

        // Decodes BlockWithRefs from a DataView
        static decodeDataView(view: DataView): BlockWithRefs {
          const decoder = new __proto.Decoder(view);
          const obj = new BlockWithRefs();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.id = decoder.string();
                break;
              }
              case 2: {
                const length = decoder.uint32();
                obj.block = Block.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 3: {
                const length = decoder.uint32();
                obj.transaction_trace_refs = TransactionRefs.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 4: {
                obj.irreversible = decoder.bool();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BlockWithRefs

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.id.length > 0
              ? 1 + __proto.Sizer.varint64(this.id.length) + this.id.length
              : 0;

          if (this.block != null) {
            const f: Block = this.block as Block;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.transaction_trace_refs != null) {
            const f: TransactionRefs = this
              .transaction_trace_refs as TransactionRefs;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.irreversible == 0 ? 0 : 1 + 1;

          return size;
        }

        // Encodes BlockWithRefs to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BlockWithRefs to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.id.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.id.length);
            encoder.string(this.id);
          }

          if (this.block != null) {
            const f = this.block as Block;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x12);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.transaction_trace_refs != null) {
            const f = this.transaction_trace_refs as TransactionRefs;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.irreversible != 0) {
            encoder.uint32(0x20);
            encoder.bool(this.irreversible);
          }

          return buf;
        } // encode BlockWithRefs
      } // BlockWithRefs

      export class TransactionTraceWithBlockRef {
        public trace: TransactionTrace = new TransactionTrace();
        public block_ref: BlockRef = new BlockRef();

        // Decodes TransactionTraceWithBlockRef from an ArrayBuffer
        static decode(buf: ArrayBuffer): TransactionTraceWithBlockRef {
          return TransactionTraceWithBlockRef.decodeDataView(new DataView(buf));
        }

        // Decodes TransactionTraceWithBlockRef from a DataView
        static decodeDataView(view: DataView): TransactionTraceWithBlockRef {
          const decoder = new __proto.Decoder(view);
          const obj = new TransactionTraceWithBlockRef();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const length = decoder.uint32();
                obj.trace = TransactionTrace.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 2: {
                const length = decoder.uint32();
                obj.block_ref = BlockRef.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
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
        } // decode TransactionTraceWithBlockRef

        public size(): u32 {
          let size: u32 = 0;

          if (this.trace != null) {
            const f: TransactionTrace = this.trace as TransactionTrace;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.block_ref != null) {
            const f: BlockRef = this.block_ref as BlockRef;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes TransactionTraceWithBlockRef to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes TransactionTraceWithBlockRef to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.trace != null) {
            const f = this.trace as TransactionTrace;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0xa);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.block_ref != null) {
            const f = this.block_ref as BlockRef;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x12);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode TransactionTraceWithBlockRef
      } // TransactionTraceWithBlockRef

      export class TransactionRefs {
        public hashes: Array<Array<u8>> = new Array<Array<u8>>();

        // Decodes TransactionRefs from an ArrayBuffer
        static decode(buf: ArrayBuffer): TransactionRefs {
          return TransactionRefs.decodeDataView(new DataView(buf));
        }

        // Decodes TransactionRefs from a DataView
        static decodeDataView(view: DataView): TransactionRefs {
          const decoder = new __proto.Decoder(view);
          const obj = new TransactionRefs();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.hashes.push(decoder.bytes());
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode TransactionRefs

        public size(): u32 {
          let size: u32 = 0;

          size += __size_bytes_repeated(this.hashes);

          return size;
        }

        // Encodes TransactionRefs to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes TransactionRefs to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.hashes.length > 0) {
            for (let n: i32 = 0; n < this.hashes.length; n++) {
              encoder.uint32(0xa);
              encoder.uint32(this.hashes[n].length);
              encoder.bytes(this.hashes[n]);
            }
          }

          return buf;
        } // encode TransactionRefs
      } // TransactionRefs

      export class BlockRef {
        public hash: Array<u8> = new Array<u8>();
        public number: u64;

        // Decodes BlockRef from an ArrayBuffer
        static decode(buf: ArrayBuffer): BlockRef {
          return BlockRef.decodeDataView(new DataView(buf));
        }

        // Decodes BlockRef from a DataView
        static decodeDataView(view: DataView): BlockRef {
          const decoder = new __proto.Decoder(view);
          const obj = new BlockRef();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.hash = decoder.bytes();
                break;
              }
              case 2: {
                obj.number = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BlockRef

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.hash.length > 0
              ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;
          size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);

          return size;
        }

        // Encodes BlockRef to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BlockRef to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.hash.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.hash.length);
            encoder.bytes(this.hash);
          }
          if (this.number != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.number);
          }

          return buf;
        } // encode BlockRef
      } // BlockRef
    } // v2
  } // ethereum
  export namespace type {
    export namespace v2 {
      export enum TransactionTraceStatus {
        UNKNOWN = 0,
        SUCCEEDED = 1,
        FAILED = 2,
        REVERTED = 3,
      } // TransactionTraceStatus
      export enum CallType {
        UNSPECIFIED = 0,
        // direct? what's the name for `Call` alone?
        CALL = 1,
        CALLCODE = 2,
        DELEGATE = 3,
        STATIC = 4,
        // create2 ? any other form of calls?
        CREATE = 5,
      } // CallType
      export class Block {
        // Hash is the block's hash.
        public hash: Array<u8> = new Array<u8>();
        // Number is the block's height at which this block was mined.
        public number: u64;
        /**
         * Size is the size in bytes of the RLP encoding of the block according to Ethereum
         *  rules.
         * uint64 size = 4;
         *  Header contain's the block's header information like its parent hash, the merkel root hash
         *  and all other information the form a block.
         */
        public header: BlockHeader = new BlockHeader();
        /**
         * Uncles represents block produced with a valid solution but were not actually choosen
         *  as the canonical block for the given height so they are mostly "forked" blocks.
         *
         *  If the Block has been produced using the Proof of Stake consensus algorithm, this
         *  field will actually be always empty.
         */
        public uncles: Array<BlockHeader> = new Array<BlockHeader>();
        /**
         * TransactionTraces hold the execute trace of all the transactions that were executed
         *  in this block. In in there that you will find most of the Ethereum data model.
         *
         *  They are ordered by the order of execution of the transaction in the block.
         */
        public transaction_traces: Array<TransactionTrace> =
          new Array<TransactionTrace>();
        /**
         * BalanceChanges here is the array of ETH transfer that happened at the block level
         *  outside of the normal transaction flow of a block. The best example of this is mining
         *  reward for the block mined, the transfer of ETH to the miner happens outside the normal
         *  transaction flow of the chain and is recorded as a `BalanceChange` here since we cannot
         *  attached it to any transaction.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public balance_changes: Array<BalanceChange> =
          new Array<BalanceChange>();
        /**
         * DetailLevel affects the data available in this block.
         *
         *  EXTENDED describes the most complete block, with traces, balance changes, storage changes. It is extracted during the execution of the block.
         *  BASE describes a block that contains only the block header, transaction receipts and event logs: everything that can be extracted using the base JSON-RPC interface (https://ethereum.org/en/developers/docs/apis/json-rpc/#json-rpc-methods)
         *       Furthermore, the eth_getTransactionReceipt call has been avoided because it brings only minimal improvements at the cost of requiring an archive node or a full node with complete transaction index.
         */
        public detail_level: u32;
        /**
         * CodeChanges here is the array of smart code change that happened that happened at the block level
         *  outside of the normal transaction flow of a block. Some Ethereum's fork like BSC and Polygon
         *  has some capabilities to upgrade internal smart contracts used usually to track the validator
         *  list.
         *
         *  On hard fork, some procedure runs to upgrade the smart contract code to a new version. In those
         *  network, a `CodeChange` for each modified smart contract on upgrade would be present here. Note
         *  that this happen rarely, so the vast majority of block will have an empty list here.
         *  Only available in DetailLevel: EXTENDED
         */
        public code_changes: Array<CodeChange> = new Array<CodeChange>();
        /**
         * System calls are introduced in Cancun, along with blobs. They are executed outside of transactions but affect the state.
         *  Only available in DetailLevel: EXTENDED
         */
        public system_calls: Array<Call> = new Array<Call>();
        /**
         * Ver represents that data model version of the block, it is used internally by Firehose on Ethereum
         *  as a validation that we are reading the correct version.
         */
        public ver: i32;

        // Decodes Block from an ArrayBuffer
        static decode(buf: ArrayBuffer): Block {
          return Block.decodeDataView(new DataView(buf));
        }

        // Decodes Block from a DataView
        static decodeDataView(view: DataView): Block {
          const decoder = new __proto.Decoder(view);
          const obj = new Block();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 2: {
                obj.hash = decoder.bytes();
                break;
              }
              case 3: {
                obj.number = decoder.uint64();
                break;
              }
              case 5: {
                const length = decoder.uint32();
                obj.header = BlockHeader.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 6: {
                const length = decoder.uint32();
                obj.uncles.push(
                  BlockHeader.decodeDataView(
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
              case 10: {
                const length = decoder.uint32();
                obj.transaction_traces.push(
                  TransactionTrace.decodeDataView(
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
              case 11: {
                const length = decoder.uint32();
                obj.balance_changes.push(
                  BalanceChange.decodeDataView(
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
              case 12: {
                obj.detail_level = decoder.uint32();
                break;
              }
              case 20: {
                const length = decoder.uint32();
                obj.code_changes.push(
                  CodeChange.decodeDataView(
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
              case 21: {
                const length = decoder.uint32();
                obj.system_calls.push(
                  Call.decodeDataView(
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
              case 1: {
                obj.ver = decoder.int32();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Block

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.hash.length > 0
              ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;
          size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);

          if (this.header != null) {
            const f: BlockHeader = this.header as BlockHeader;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.uncles.length; n++) {
            const messageSize = this.uncles[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.transaction_traces.length; n++) {
            const messageSize = this.transaction_traces[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.balance_changes.length; n++) {
            const messageSize = this.balance_changes[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.detail_level == 0
              ? 0
              : 1 + __proto.Sizer.uint32(this.detail_level);

          for (let n: i32 = 0; n < this.code_changes.length; n++) {
            const messageSize = this.code_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.system_calls.length; n++) {
            const messageSize = this.system_calls[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.ver == 0 ? 0 : 1 + __proto.Sizer.int32(this.ver);

          return size;
        }

        // Encodes Block to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Block to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.hash.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.hash.length);
            encoder.bytes(this.hash);
          }
          if (this.number != 0) {
            encoder.uint32(0x18);
            encoder.uint64(this.number);
          }

          if (this.header != null) {
            const f = this.header as BlockHeader;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.uncles.length; n++) {
            const messageSize = this.uncles[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x32);
              encoder.uint32(messageSize);
              this.uncles[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.transaction_traces.length; n++) {
            const messageSize = this.transaction_traces[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x52);
              encoder.uint32(messageSize);
              this.transaction_traces[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.balance_changes.length; n++) {
            const messageSize = this.balance_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x5a);
              encoder.uint32(messageSize);
              this.balance_changes[n].encodeU8Array(encoder);
            }
          }

          if (this.detail_level != 0) {
            encoder.uint32(0x60);
            encoder.uint32(this.detail_level);
          }

          for (let n: i32 = 0; n < this.code_changes.length; n++) {
            const messageSize = this.code_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xa2);
              encoder.uint32(messageSize);
              this.code_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.system_calls.length; n++) {
            const messageSize = this.system_calls[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xaa);
              encoder.uint32(messageSize);
              this.system_calls[n].encodeU8Array(encoder);
            }
          }

          if (this.ver != 0) {
            encoder.uint32(0x8);
            encoder.int32(this.ver);
          }

          return buf;
        } // encode Block
      } // Block

      export enum Block_DetailLevel {
        DETAILLEVEL_EXTENDED = 0,
        // DETAILLEVEL_TRACE = 1; // TBD
        DETAILLEVEL_BASE = 2,
      } // Block_DetailLevel
      /**
       * BlockWithRefs is a lightweight block, with traces and transactions
       *  purged from the `block` within, and only.  It is used in transports
       *  to pass block data around.
       */
      export class BlockHeader {
        public parent_hash: Array<u8> = new Array<u8>();
        /**
         * Uncle hash of the block, some reference it as `sha3Uncles`, but `sha3`` is badly worded, so we prefer `uncle_hash`, also
         *  referred as `ommers` in EIP specification.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field will actually be constant and set to `0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347`.
         */
        public uncle_hash: Array<u8> = new Array<u8>();
        public coinbase: Array<u8> = new Array<u8>();
        public state_root: Array<u8> = new Array<u8>();
        public transactions_root: Array<u8> = new Array<u8>();
        public receipt_root: Array<u8> = new Array<u8>();
        public logs_bloom: Array<u8> = new Array<u8>();
        /**
         * Difficulty is the difficulty of the Proof of Work algorithm that was required to compute a solution.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field will actually be constant and set to `0x00`.
         */
        public difficulty: BigInt = new BigInt();
        /**
         * TotalDifficulty is the sum of all previous blocks difficulty including this block difficulty.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field will actually be constant and set to the terminal total difficulty
         *  that was required to transition to Proof of Stake algorithm, which varies per network. It is set to
         *  58 750 000 000 000 000 000 000 on Ethereum Mainnet and to 10 790 000 on Ethereum Testnet Goerli.
         */
        public total_difficulty: BigInt = new BigInt();
        public number: u64;
        public gas_limit: u64;
        public gas_used: u64;
        public timestamp: google.protobuf.Timestamp =
          new google.protobuf.Timestamp();
        /**
         * ExtraData is free-form bytes included in the block by the "miner". While on Yellow paper of
         *  Ethereum this value is maxed to 32 bytes, other consensus algorithm like Clique and some other
         *  forks are using bigger values to carry special consensus data.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field is strictly enforced to be <= 32 bytes.
         */
        public extra_data: Array<u8> = new Array<u8>();
        /**
         * MixHash is used to prove, when combined with the `nonce` that sufficient amount of computation has been
         *  achieved and that the solution found is valid.
         */
        public mix_hash: Array<u8> = new Array<u8>();
        /**
         * Nonce is used to prove, when combined with the `mix_hash` that sufficient amount of computation has been
         *  achieved and that the solution found is valid.
         *
         *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
         *  consensus algorithm, this field will actually be constant and set to `0`.
         */
        public nonce: u64;
        /**
         * Hash is the hash of the block which is actually the computation:
         *
         *   Keccak256(rlp([
         *     parent_hash,
         *     uncle_hash,
         *     coinbase,
         *     state_root,
         *     transactions_root,
         *     receipt_root,
         *     logs_bloom,
         *     difficulty,
         *     number,
         *     gas_limit,
         *     gas_used,
         *     timestamp,
         *     extra_data,
         *     mix_hash,
         *     nonce,
         *     base_fee_per_gas (to be included only if London fork is active)
         *     withdrawals_root (to be included only if Shangai fork is active)
         *     blob_gas_used (to be included only if Cancun fork is active)
         *     excess_blob_gas (to be included only if Cancun fork is active)
         *     parent_beacon_root (to be included only if Cancun fork is active)
         *   ]))
         */
        public hash: Array<u8> = new Array<u8>();
        // Base fee per gas according to EIP-1559 (e.g. London Fork) rules, only set if London is present/active on the chain.
        public base_fee_per_gas: BigInt = new BigInt();
        /**
         * Withdrawals root hash according to EIP-4895 (e.g. Shangai Fork) rules, only set if Shangai is present/active on the chain.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public withdrawals_root: Array<u8> = new Array<u8>();
        // Only available in DetailLevel: EXTENDED
        public tx_dependency: Uint64NestedArray = new Uint64NestedArray();
        // BlobGasUsed was added by EIP-4844 and is ignored in legacy headers.
        public blob_gas_used: u64;
        // ExcessBlobGas was added by EIP-4844 and is ignored in legacy headers.
        public excess_blob_gas: u64;
        // ParentBeaconRoot was added by EIP-4788 and is ignored in legacy headers.
        public parent_beacon_root: Array<u8> = new Array<u8>();

        public ___blob_gas_used: string = "";
        public ___blob_gas_used_index: u8 = 0;

        public ___excess_blob_gas: string = "";
        public ___excess_blob_gas_index: u8 = 0;

        static readonly BLOB_GAS_USED_BLOB_GAS_USED_INDEX: u8 = 22;
        static readonly EXCESS_BLOB_GAS_EXCESS_BLOB_GAS_INDEX: u8 = 23;

        // Decodes BlockHeader from an ArrayBuffer
        static decode(buf: ArrayBuffer): BlockHeader {
          return BlockHeader.decodeDataView(new DataView(buf));
        }

        // Decodes BlockHeader from a DataView
        static decodeDataView(view: DataView): BlockHeader {
          const decoder = new __proto.Decoder(view);
          const obj = new BlockHeader();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.parent_hash = decoder.bytes();
                break;
              }
              case 2: {
                obj.uncle_hash = decoder.bytes();
                break;
              }
              case 3: {
                obj.coinbase = decoder.bytes();
                break;
              }
              case 4: {
                obj.state_root = decoder.bytes();
                break;
              }
              case 5: {
                obj.transactions_root = decoder.bytes();
                break;
              }
              case 6: {
                obj.receipt_root = decoder.bytes();
                break;
              }
              case 7: {
                obj.logs_bloom = decoder.bytes();
                break;
              }
              case 8: {
                const length = decoder.uint32();
                obj.difficulty = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 17: {
                const length = decoder.uint32();
                obj.total_difficulty = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 9: {
                obj.number = decoder.uint64();
                break;
              }
              case 10: {
                obj.gas_limit = decoder.uint64();
                break;
              }
              case 11: {
                obj.gas_used = decoder.uint64();
                break;
              }
              case 12: {
                const length = decoder.uint32();
                obj.timestamp = google.protobuf.Timestamp.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 13: {
                obj.extra_data = decoder.bytes();
                break;
              }
              case 14: {
                obj.mix_hash = decoder.bytes();
                break;
              }
              case 15: {
                obj.nonce = decoder.uint64();
                break;
              }
              case 16: {
                obj.hash = decoder.bytes();
                break;
              }
              case 18: {
                const length = decoder.uint32();
                obj.base_fee_per_gas = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 19: {
                obj.withdrawals_root = decoder.bytes();
                break;
              }
              case 20: {
                const length = decoder.uint32();
                obj.tx_dependency = Uint64NestedArray.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 22: {
                obj.blob_gas_used = decoder.uint64();
                obj.___blob_gas_used = "blob_gas_used";
                obj.___blob_gas_used_index = 22;
                break;
              }
              case 23: {
                obj.excess_blob_gas = decoder.uint64();
                obj.___excess_blob_gas = "excess_blob_gas";
                obj.___excess_blob_gas_index = 23;
                break;
              }
              case 24: {
                obj.parent_beacon_root = decoder.bytes();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BlockHeader

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.parent_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.parent_hash.length) +
                this.parent_hash.length
              : 0;
          size +=
            this.uncle_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.uncle_hash.length) +
                this.uncle_hash.length
              : 0;
          size +=
            this.coinbase.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.coinbase.length) +
                this.coinbase.length
              : 0;
          size +=
            this.state_root.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.state_root.length) +
                this.state_root.length
              : 0;
          size +=
            this.transactions_root.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.transactions_root.length) +
                this.transactions_root.length
              : 0;
          size +=
            this.receipt_root.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.receipt_root.length) +
                this.receipt_root.length
              : 0;
          size +=
            this.logs_bloom.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.logs_bloom.length) +
                this.logs_bloom.length
              : 0;

          if (this.difficulty != null) {
            const f: BigInt = this.difficulty as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.total_difficulty != null) {
            const f: BigInt = this.total_difficulty as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);
          size +=
            this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);
          size +=
            this.gas_used == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_used);

          if (this.timestamp != null) {
            const f: google.protobuf.Timestamp = this
              .timestamp as google.protobuf.Timestamp;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.extra_data.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.extra_data.length) +
                this.extra_data.length
              : 0;
          size +=
            this.mix_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.mix_hash.length) +
                this.mix_hash.length
              : 0;
          size += this.nonce == 0 ? 0 : 1 + __proto.Sizer.uint64(this.nonce);
          size +=
            this.hash.length > 0
              ? 2 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;

          if (this.base_fee_per_gas != null) {
            const f: BigInt = this.base_fee_per_gas as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.withdrawals_root.length > 0
              ? 2 +
                __proto.Sizer.varint64(this.withdrawals_root.length) +
                this.withdrawals_root.length
              : 0;

          if (this.tx_dependency != null) {
            const f: Uint64NestedArray = this
              .tx_dependency as Uint64NestedArray;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.blob_gas_used == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.blob_gas_used);
          size +=
            this.excess_blob_gas == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.excess_blob_gas);
          size +=
            this.parent_beacon_root.length > 0
              ? 2 +
                __proto.Sizer.varint64(this.parent_beacon_root.length) +
                this.parent_beacon_root.length
              : 0;

          return size;
        }

        // Encodes BlockHeader to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BlockHeader to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.parent_hash.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.parent_hash.length);
            encoder.bytes(this.parent_hash);
          }
          if (this.uncle_hash.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.uncle_hash.length);
            encoder.bytes(this.uncle_hash);
          }
          if (this.coinbase.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.coinbase.length);
            encoder.bytes(this.coinbase);
          }
          if (this.state_root.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.state_root.length);
            encoder.bytes(this.state_root);
          }
          if (this.transactions_root.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.transactions_root.length);
            encoder.bytes(this.transactions_root);
          }
          if (this.receipt_root.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.receipt_root.length);
            encoder.bytes(this.receipt_root);
          }
          if (this.logs_bloom.length > 0) {
            encoder.uint32(0x3a);
            encoder.uint32(this.logs_bloom.length);
            encoder.bytes(this.logs_bloom);
          }

          if (this.difficulty != null) {
            const f = this.difficulty as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x42);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.total_difficulty != null) {
            const f = this.total_difficulty as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x8a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.number != 0) {
            encoder.uint32(0x48);
            encoder.uint64(this.number);
          }
          if (this.gas_limit != 0) {
            encoder.uint32(0x50);
            encoder.uint64(this.gas_limit);
          }
          if (this.gas_used != 0) {
            encoder.uint32(0x58);
            encoder.uint64(this.gas_used);
          }

          if (this.timestamp != null) {
            const f = this.timestamp as google.protobuf.Timestamp;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x62);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.extra_data.length > 0) {
            encoder.uint32(0x6a);
            encoder.uint32(this.extra_data.length);
            encoder.bytes(this.extra_data);
          }
          if (this.mix_hash.length > 0) {
            encoder.uint32(0x72);
            encoder.uint32(this.mix_hash.length);
            encoder.bytes(this.mix_hash);
          }
          if (this.nonce != 0) {
            encoder.uint32(0x78);
            encoder.uint64(this.nonce);
          }
          if (this.hash.length > 0) {
            encoder.uint32(0x82);
            encoder.uint32(this.hash.length);
            encoder.bytes(this.hash);
          }

          if (this.base_fee_per_gas != null) {
            const f = this.base_fee_per_gas as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x92);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.withdrawals_root.length > 0) {
            encoder.uint32(0x9a);
            encoder.uint32(this.withdrawals_root.length);
            encoder.bytes(this.withdrawals_root);
          }

          if (this.tx_dependency != null) {
            const f = this.tx_dependency as Uint64NestedArray;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0xa2);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.blob_gas_used != 0) {
            encoder.uint32(0xb0);
            encoder.uint64(this.blob_gas_used);
          }
          if (this.excess_blob_gas != 0) {
            encoder.uint32(0xb8);
            encoder.uint64(this.excess_blob_gas);
          }
          if (this.parent_beacon_root.length > 0) {
            encoder.uint32(0xc2);
            encoder.uint32(this.parent_beacon_root.length);
            encoder.bytes(this.parent_beacon_root);
          }

          return buf;
        } // encode BlockHeader
      } // BlockHeader

      export class Uint64NestedArray {
        public val: Array<Uint64Array> = new Array<Uint64Array>();

        // Decodes Uint64NestedArray from an ArrayBuffer
        static decode(buf: ArrayBuffer): Uint64NestedArray {
          return Uint64NestedArray.decodeDataView(new DataView(buf));
        }

        // Decodes Uint64NestedArray from a DataView
        static decodeDataView(view: DataView): Uint64NestedArray {
          const decoder = new __proto.Decoder(view);
          const obj = new Uint64NestedArray();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const length = decoder.uint32();
                obj.val.push(
                  Uint64Array.decodeDataView(
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
        } // decode Uint64NestedArray

        public size(): u32 {
          let size: u32 = 0;

          for (let n: i32 = 0; n < this.val.length; n++) {
            const messageSize = this.val[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes Uint64NestedArray to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Uint64NestedArray to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          for (let n: i32 = 0; n < this.val.length; n++) {
            const messageSize = this.val[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xa);
              encoder.uint32(messageSize);
              this.val[n].encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode Uint64NestedArray
      } // Uint64NestedArray

      export class Uint64Array {
        public val: Array<u64> = new Array<u64>();

        // Decodes Uint64Array from an ArrayBuffer
        static decode(buf: ArrayBuffer): Uint64Array {
          return Uint64Array.decodeDataView(new DataView(buf));
        }

        // Decodes Uint64Array from a DataView
        static decodeDataView(view: DataView): Uint64Array {
          const decoder = new __proto.Decoder(view);
          const obj = new Uint64Array();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const endPos = decoder.pos + decoder.uint32();
                while (decoder.pos <= endPos) {
                  obj.val.push(decoder.uint64());
                }

                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Uint64Array

        public size(): u32 {
          let size: u32 = 0;

          if (this.val.length > 0) {
            const packedSize = __size_uint64_repeated_packed(this.val);
            if (packedSize > 0) {
              size += 1 + __proto.Sizer.varint64(packedSize) + packedSize;
            }
          }

          return size;
        }

        // Encodes Uint64Array to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Uint64Array to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.val.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(__size_uint64_repeated_packed(this.val));

            for (let n: i32 = 0; n < this.val.length; n++) {
              encoder.uint64(this.val[n]);
            }
          }

          return buf;
        } // encode Uint64Array
      } // Uint64Array

      export class BigInt {
        public bytes: Array<u8> = new Array<u8>();

        // Decodes BigInt from an ArrayBuffer
        static decode(buf: ArrayBuffer): BigInt {
          return BigInt.decodeDataView(new DataView(buf));
        }

        // Decodes BigInt from a DataView
        static decodeDataView(view: DataView): BigInt {
          const decoder = new __proto.Decoder(view);
          const obj = new BigInt();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.bytes = decoder.bytes();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BigInt

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.bytes.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.bytes.length) +
                this.bytes.length
              : 0;

          return size;
        }

        // Encodes BigInt to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BigInt to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.bytes.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.bytes.length);
            encoder.bytes(this.bytes);
          }

          return buf;
        } // encode BigInt
      } // BigInt

      /**
       * TransactionTrace is full trace of execution of the transaction when the
       *  it actually executed on chain.
       *
       *  It contains all the transaction details like `from`, `to`, `gas`, etc.
       *  as well as all the internal calls that were made during the transaction.
       *
       *  The `calls` vector contains Call objects which have balance changes, events
       *  storage changes, etc.
       *
       *  If ordering is important between elements, almost each message like `Log`,
       *  `Call`, `StorageChange`, etc. have an ordinal field that is represents "execution"
       *  order of the said element against all other elements in this block.
       *
       *  Due to how the call tree works doing "naively", looping through all calls then
       *  through a Call's element like `logs` while not yielding the elements in the order
       *  they were executed on chain. A log in call could have been done before or after
       *  another in another call depending on the actual call tree.
       *
       *  The `calls` are ordered by creation order and the call tree can be re-computing
       *  using fields found in `Call` object (parent/child relationship).
       *
       *  Another important thing to note is that even if a transaction succeed, some calls
       *  within it could have been reverted internally, if this is important to you, you must
       *  check the field `state_reverted` on the `Call` to determine if it was fully committed
       *  to the chain or not.
       */
      export class TransactionTrace {
        // consensus
        public to: Array<u8> = new Array<u8>();
        public nonce: u64;
        /**
         * GasPrice represents the effective price that has been paid for each gas unit of this transaction. Over time, the
         *  Ethereum rules changes regarding GasPrice field here. Before London fork, the GasPrice was always set to the
         *  fixed gas price. After London fork, this value has different meaning depending on the transaction type (see `Type` field).
         *
         *  In cases where `TransactionTrace.Type == TRX_TYPE_LEGACY || TRX_TYPE_ACCESS_LIST`, then GasPrice has the same meaning
         *  as before the London fork.
         *
         *  In cases where `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE`, then GasPrice is the effective gas price paid
         *  for the transaction which is equals to `BlockHeader.BaseFeePerGas + TransactionTrace.`
         */
        public gas_price: BigInt = new BigInt();
        /**
         * GasLimit is the maximum of gas unit the sender of the transaction is willing to consume when perform the EVM
         *  execution of the whole transaction
         */
        public gas_limit: u64;
        // Value is the amount of Ether transferred as part of this transaction.
        public value: BigInt = new BigInt();
        // Input data the transaction will receive for execution of EVM.
        public input: Array<u8> = new Array<u8>();
        // V is the recovery ID value for the signature Y point.
        public v: Array<u8> = new Array<u8>();
        // R is the signature's X point on the elliptic curve (32 bytes).
        public r: Array<u8> = new Array<u8>();
        // S is the signature's Y point on the elliptic curve (32 bytes).
        public s: Array<u8> = new Array<u8>();
        // GasUsed is the total amount of gas unit used for the whole execution of the transaction.
        public gas_used: u64;
        /**
         * Type represents the Ethereum transaction type, available only since EIP-2718 & EIP-2930 activation which happened on Berlin fork.
         *  The value is always set even for transaction before Berlin fork because those before the fork are still legacy transactions.
         */
        public type: u32;
        /**
         * AcccessList represents the storage access this transaction has agreed to do in which case those storage
         *  access cost less gas unit per access.
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_ACCESS_LIST || TRX_TYPE_DYNAMIC_FEE` which
         *  is possible only if Berlin (TRX_TYPE_ACCESS_LIST) nor London (TRX_TYPE_DYNAMIC_FEE) fork are active on the chain.
         */
        public access_list: Array<AccessTuple> = new Array<AccessTuple>();
        /**
         * MaxFeePerGas is the maximum fee per gas the user is willing to pay for the transaction gas used.
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE` which is possible only
         *  if Londong fork is active on the chain.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public max_fee_per_gas: BigInt = new BigInt();
        /**
         * MaxPriorityFeePerGas is priority fee per gas the user to pay in extra to the miner on top of the block's
         *  base fee.
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE` which is possible only
         *  if London fork is active on the chain.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public max_priority_fee_per_gas: BigInt = new BigInt();
        // meta
        public index: u32;
        public hash: Array<u8> = new Array<u8>();
        public from: Array<u8> = new Array<u8>();
        // Only available in DetailLevel: EXTENDED
        public return_data: Array<u8> = new Array<u8>();
        // Only available in DetailLevel: EXTENDED
        public public_key: Array<u8> = new Array<u8>();
        public begin_ordinal: u64;
        public end_ordinal: u64;
        /**
         * TransactionTraceStatus is the status of the transaction execution and will let you know if the transaction
         *  was successful or not.
         *
         *  A successful transaction has been recorded to the blockchain's state for calls in it that were successful.
         *  This means it's possible only a subset of the calls were properly recorded, refer to [calls[].state_reverted] field
         *  to determine which calls were reverted.
         *
         *  A quirks of the Ethereum protocol is that a transaction `FAILED` or `REVERTED` still affects the blockchain's
         *  state for **some** of the state changes. Indeed, in those cases, the transactions fees are still paid to the miner
         *  which means there is a balance change for the transaction's emitter (e.g. `from`) to pay the gas fees, an optional
         *  balance change for gas refunded to the transaction's emitter (e.g. `from`) and a balance change for the miner who
         *  received the transaction fees. There is also a nonce change for the transaction's emitter (e.g. `from`).
         *
         *  This means that to properly record the state changes for a transaction, you need to conditionally procees the
         *  transaction's status.
         *
         *  For a `SUCCEEDED` transaction, you iterate over the `calls` array and record the state changes for each call for
         *  which `state_reverted == false` (if a transaction succeeded, the call at #0 will always `state_reverted == false`
         *  because it aligns with the transaction).
         *
         *  For a `FAILED` or `REVERTED` transaction, you iterate over the root call (e.g. at #0, will always exist) for
         *  balance changes you process those where `reason` is either `REASON_GAS_BUY`, `REASON_GAS_REFUND` or
         *  `REASON_REWARD_TRANSACTION_FEE` and for nonce change, still on the root call, you pick the nonce change which the
         *  smallest ordinal (if more than one).
         */
        public status: u32;
        public receipt: TransactionReceipt = new TransactionReceipt();
        // Only available in DetailLevel: EXTENDED
        public calls: Array<Call> = new Array<Call>();
        /**
         * BlobGas is the amount of gas the transaction is going to pay for the blobs, this is a computed value
         *  equivalent to `self.blob_gas_fee_cap * len(self.blob_hashes)` and provided in the model for convenience.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_gas: u64;
        /**
         * BlobGasFeeCap is the maximum fee per data gas the user is willing to pay for the data gas used.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_gas_fee_cap: BigInt | null;
        /**
         * BlobHashes field represents a list of hash outputs from 'kzg_to_versioned_hash' which
         *  essentially is a version byte + the sha256 hash of the blob commitment (e.g.
         *  `BLOB_COMMITMENT_VERSION_KZG + sha256(commitment)[1:]`.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_hashes: Array<Array<u8>> = new Array<Array<u8>>();

        public ___blob_gas: string = "";
        public ___blob_gas_index: u8 = 0;

        public ___blob_gas_fee_cap: string = "";
        public ___blob_gas_fee_cap_index: u8 = 0;

        static readonly BLOB_GAS_BLOB_GAS_INDEX: u8 = 33;
        static readonly BLOB_GAS_FEE_CAP_BLOB_GAS_FEE_CAP_INDEX: u8 = 34;

        // Decodes TransactionTrace from an ArrayBuffer
        static decode(buf: ArrayBuffer): TransactionTrace {
          return TransactionTrace.decodeDataView(new DataView(buf));
        }

        // Decodes TransactionTrace from a DataView
        static decodeDataView(view: DataView): TransactionTrace {
          const decoder = new __proto.Decoder(view);
          const obj = new TransactionTrace();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.to = decoder.bytes();
                break;
              }
              case 2: {
                obj.nonce = decoder.uint64();
                break;
              }
              case 3: {
                const length = decoder.uint32();
                obj.gas_price = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 4: {
                obj.gas_limit = decoder.uint64();
                break;
              }
              case 5: {
                const length = decoder.uint32();
                obj.value = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 6: {
                obj.input = decoder.bytes();
                break;
              }
              case 7: {
                obj.v = decoder.bytes();
                break;
              }
              case 8: {
                obj.r = decoder.bytes();
                break;
              }
              case 9: {
                obj.s = decoder.bytes();
                break;
              }
              case 10: {
                obj.gas_used = decoder.uint64();
                break;
              }
              case 12: {
                obj.type = decoder.uint32();
                break;
              }
              case 14: {
                const length = decoder.uint32();
                obj.access_list.push(
                  AccessTuple.decodeDataView(
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
              case 11: {
                const length = decoder.uint32();
                obj.max_fee_per_gas = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 13: {
                const length = decoder.uint32();
                obj.max_priority_fee_per_gas = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 20: {
                obj.index = decoder.uint32();
                break;
              }
              case 21: {
                obj.hash = decoder.bytes();
                break;
              }
              case 22: {
                obj.from = decoder.bytes();
                break;
              }
              case 23: {
                obj.return_data = decoder.bytes();
                break;
              }
              case 24: {
                obj.public_key = decoder.bytes();
                break;
              }
              case 25: {
                obj.begin_ordinal = decoder.uint64();
                break;
              }
              case 26: {
                obj.end_ordinal = decoder.uint64();
                break;
              }
              case 30: {
                obj.status = decoder.uint32();
                break;
              }
              case 31: {
                const length = decoder.uint32();
                obj.receipt = TransactionReceipt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 32: {
                const length = decoder.uint32();
                obj.calls.push(
                  Call.decodeDataView(
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
              case 33: {
                obj.blob_gas = decoder.uint64();
                obj.___blob_gas = "blob_gas";
                obj.___blob_gas_index = 33;
                break;
              }
              case 34: {
                const length = decoder.uint32();
                obj.blob_gas_fee_cap = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                obj.___blob_gas_fee_cap = "blob_gas_fee_cap";
                obj.___blob_gas_fee_cap_index = 34;
                break;
              }
              case 35: {
                obj.blob_hashes.push(decoder.bytes());
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode TransactionTrace

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.to.length > 0
              ? 1 + __proto.Sizer.varint64(this.to.length) + this.to.length
              : 0;
          size += this.nonce == 0 ? 0 : 1 + __proto.Sizer.uint64(this.nonce);

          if (this.gas_price != null) {
            const f: BigInt = this.gas_price as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);

          if (this.value != null) {
            const f: BigInt = this.value as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.input.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.input.length) +
                this.input.length
              : 0;
          size +=
            this.v.length > 0
              ? 1 + __proto.Sizer.varint64(this.v.length) + this.v.length
              : 0;
          size +=
            this.r.length > 0
              ? 1 + __proto.Sizer.varint64(this.r.length) + this.r.length
              : 0;
          size +=
            this.s.length > 0
              ? 1 + __proto.Sizer.varint64(this.s.length) + this.s.length
              : 0;
          size +=
            this.gas_used == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_used);
          size += this.type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.type);

          for (let n: i32 = 0; n < this.access_list.length; n++) {
            const messageSize = this.access_list[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.max_fee_per_gas != null) {
            const f: BigInt = this.max_fee_per_gas as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.max_priority_fee_per_gas != null) {
            const f: BigInt = this.max_priority_fee_per_gas as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.index == 0 ? 0 : 2 + __proto.Sizer.uint32(this.index);
          size +=
            this.hash.length > 0
              ? 2 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;
          size +=
            this.from.length > 0
              ? 2 + __proto.Sizer.varint64(this.from.length) + this.from.length
              : 0;
          size +=
            this.return_data.length > 0
              ? 2 +
                __proto.Sizer.varint64(this.return_data.length) +
                this.return_data.length
              : 0;
          size +=
            this.public_key.length > 0
              ? 2 +
                __proto.Sizer.varint64(this.public_key.length) +
                this.public_key.length
              : 0;
          size +=
            this.begin_ordinal == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.begin_ordinal);
          size +=
            this.end_ordinal == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.end_ordinal);
          size += this.status == 0 ? 0 : 2 + __proto.Sizer.uint32(this.status);

          if (this.receipt != null) {
            const f: TransactionReceipt = this.receipt as TransactionReceipt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.calls.length; n++) {
            const messageSize = this.calls[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.blob_gas == 0 ? 0 : 2 + __proto.Sizer.uint64(this.blob_gas);

          if (this.blob_gas_fee_cap != null) {
            const f: BigInt = this.blob_gas_fee_cap as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += __size_bytes_repeated(this.blob_hashes);

          return size;
        }

        // Encodes TransactionTrace to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes TransactionTrace to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.to.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.to.length);
            encoder.bytes(this.to);
          }
          if (this.nonce != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.nonce);
          }

          if (this.gas_price != null) {
            const f = this.gas_price as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.gas_limit != 0) {
            encoder.uint32(0x20);
            encoder.uint64(this.gas_limit);
          }

          if (this.value != null) {
            const f = this.value as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.input.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.input.length);
            encoder.bytes(this.input);
          }
          if (this.v.length > 0) {
            encoder.uint32(0x3a);
            encoder.uint32(this.v.length);
            encoder.bytes(this.v);
          }
          if (this.r.length > 0) {
            encoder.uint32(0x42);
            encoder.uint32(this.r.length);
            encoder.bytes(this.r);
          }
          if (this.s.length > 0) {
            encoder.uint32(0x4a);
            encoder.uint32(this.s.length);
            encoder.bytes(this.s);
          }
          if (this.gas_used != 0) {
            encoder.uint32(0x50);
            encoder.uint64(this.gas_used);
          }
          if (this.type != 0) {
            encoder.uint32(0x60);
            encoder.uint32(this.type);
          }

          for (let n: i32 = 0; n < this.access_list.length; n++) {
            const messageSize = this.access_list[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x72);
              encoder.uint32(messageSize);
              this.access_list[n].encodeU8Array(encoder);
            }
          }

          if (this.max_fee_per_gas != null) {
            const f = this.max_fee_per_gas as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x5a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.max_priority_fee_per_gas != null) {
            const f = this.max_priority_fee_per_gas as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x6a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.index != 0) {
            encoder.uint32(0xa0);
            encoder.uint32(this.index);
          }
          if (this.hash.length > 0) {
            encoder.uint32(0xaa);
            encoder.uint32(this.hash.length);
            encoder.bytes(this.hash);
          }
          if (this.from.length > 0) {
            encoder.uint32(0xb2);
            encoder.uint32(this.from.length);
            encoder.bytes(this.from);
          }
          if (this.return_data.length > 0) {
            encoder.uint32(0xba);
            encoder.uint32(this.return_data.length);
            encoder.bytes(this.return_data);
          }
          if (this.public_key.length > 0) {
            encoder.uint32(0xc2);
            encoder.uint32(this.public_key.length);
            encoder.bytes(this.public_key);
          }
          if (this.begin_ordinal != 0) {
            encoder.uint32(0xc8);
            encoder.uint64(this.begin_ordinal);
          }
          if (this.end_ordinal != 0) {
            encoder.uint32(0xd0);
            encoder.uint64(this.end_ordinal);
          }
          if (this.status != 0) {
            encoder.uint32(0xf0);
            encoder.uint32(this.status);
          }

          if (this.receipt != null) {
            const f = this.receipt as TransactionReceipt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0xfa);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.calls.length; n++) {
            const messageSize = this.calls[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x102);
              encoder.uint32(messageSize);
              this.calls[n].encodeU8Array(encoder);
            }
          }

          if (this.blob_gas != 0) {
            encoder.uint32(0x108);
            encoder.uint64(this.blob_gas);
          }

          if (this.blob_gas_fee_cap != null) {
            const f = this.blob_gas_fee_cap as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x112);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.blob_hashes.length > 0) {
            for (let n: i32 = 0; n < this.blob_hashes.length; n++) {
              encoder.uint32(0x11a);
              encoder.uint32(this.blob_hashes[n].length);
              encoder.bytes(this.blob_hashes[n]);
            }
          }

          return buf;
        } // encode TransactionTrace
      } // TransactionTrace

      export enum TransactionTrace_Type {
        // All transactions that ever existed prior Berlin fork before EIP-2718 was implemented.
        TRX_TYPE_LEGACY = 0,
        /**
         * Transaction that specicy an access list of contract/storage_keys that is going to be used
         *  in this transaction.
         *
         *  Added in Berlin fork (EIP-2930).
         */
        TRX_TYPE_ACCESS_LIST = 1,
        /**
         * Transaction that specifis an access list just like TRX_TYPE_ACCESS_LIST but in addition defines the
         *  max base gas gee and max priority gas fee to pay for this transaction. Transaction's of those type are
         *  executed against EIP-1559 rules which dictates a dynamic gas cost based on the congestion of the network.
         */
        TRX_TYPE_DYNAMIC_FEE = 2,
        /**
         * Transaction which contain a large amount of data that cannot be accessed by EVM execution, but whose commitment
         *  can be accessed. The format is intended to be fully compatible with the format that will be used in full sharding.
         *
         *  Transaction that defines specifis an access list just like TRX_TYPE_ACCESS_LIST and enables dynamic fee just like
         *  TRX_TYPE_DYNAMIC_FEE but in addition defines the fields 'max_fee_per_data_gas' of type 'uint256' and the fields
         *  'blob_versioned_hashes' field represents a list of hash outputs from 'kzg_to_versioned_hash'.
         *
         *  Activated in Dencun
         */
        TRX_TYPE_BLOB = 3,
        // Arbitrum-specific transactions
        TRX_TYPE_ARBITRUM_DEPOSIT = 100,
        TRX_TYPE_ARBITRUM_UNSIGNED = 101,
        TRX_TYPE_ARBITRUM_CONTRACT = 102,
        TRX_TYPE_ARBITRUM_RETRY = 104,
        TRX_TYPE_ARBITRUM_SUBMIT_RETRYABLE = 105,
        TRX_TYPE_ARBITRUM_INTERNAL = 106,
        TRX_TYPE_ARBITRUM_LEGACY = 120,
      } // TransactionTrace_Type
      /**
       * AccessTuple represents a list of storage keys for a given contract's address and is used
       *  for AccessList construction.
       */
      export class AccessTuple {
        public address: Array<u8> = new Array<u8>();
        public storage_keys: Array<Array<u8>> = new Array<Array<u8>>();

        // Decodes AccessTuple from an ArrayBuffer
        static decode(buf: ArrayBuffer): AccessTuple {
          return AccessTuple.decodeDataView(new DataView(buf));
        }

        // Decodes AccessTuple from a DataView
        static decodeDataView(view: DataView): AccessTuple {
          const decoder = new __proto.Decoder(view);
          const obj = new AccessTuple();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.storage_keys.push(decoder.bytes());
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode AccessTuple

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          size += __size_bytes_repeated(this.storage_keys);

          return size;
        }

        // Encodes AccessTuple to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes AccessTuple to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }

          if (this.storage_keys.length > 0) {
            for (let n: i32 = 0; n < this.storage_keys.length; n++) {
              encoder.uint32(0x12);
              encoder.uint32(this.storage_keys[n].length);
              encoder.bytes(this.storage_keys[n]);
            }
          }

          return buf;
        } // encode AccessTuple
      } // AccessTuple

      export class TransactionReceipt {
        /**
         * State root is an intermediate state_root hash, computed in-between transactions to make
         *  **sure** you could build a proof and point to state in the middle of a block. Geth client
         *  uses `PostState + root + PostStateOrStatus`` while Parity used `status_code, root...`` this piles
         *  hardforks, see (read the EIPs first):
         *  - https://github.com/ethereum/EIPs/blob/master/EIPS/eip-658.md
         *
         *  Moreover, the notion of `Outcome`` in parity, which segregates the two concepts, which are
         *  stored in the same field `status_code`` can be computed based on such a hack of the `state_root`
         *  field, following `EIP-658`.
         *
         *  Before Byzantinium hard fork, this field is always empty.
         */
        public state_root: Array<u8> = new Array<u8>();
        public cumulative_gas_used: u64;
        public logs_bloom: Array<u8> = new Array<u8>();
        public logs: Array<Log> = new Array<Log>();
        /**
         * BlobGasUsed is the amount of blob gas that has been used within this transaction. At time
         *  of writing, this is equal to `self.blob_gas_fee_cap * len(self.blob_hashes)`.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_gas_used: u64;
        /**
         * BlobGasPrice is the amount to pay per blob item in the transaction.
         *
         *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
         *
         *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
         *  if Cancun fork is active on the chain.
         */
        public blob_gas_price: BigInt | null;

        public ___blob_gas_used: string = "";
        public ___blob_gas_used_index: u8 = 0;

        public ___blob_gas_price: string = "";
        public ___blob_gas_price_index: u8 = 0;

        static readonly BLOB_GAS_USED_BLOB_GAS_USED_INDEX: u8 = 5;
        static readonly BLOB_GAS_PRICE_BLOB_GAS_PRICE_INDEX: u8 = 6;

        // Decodes TransactionReceipt from an ArrayBuffer
        static decode(buf: ArrayBuffer): TransactionReceipt {
          return TransactionReceipt.decodeDataView(new DataView(buf));
        }

        // Decodes TransactionReceipt from a DataView
        static decodeDataView(view: DataView): TransactionReceipt {
          const decoder = new __proto.Decoder(view);
          const obj = new TransactionReceipt();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.state_root = decoder.bytes();
                break;
              }
              case 2: {
                obj.cumulative_gas_used = decoder.uint64();
                break;
              }
              case 3: {
                obj.logs_bloom = decoder.bytes();
                break;
              }
              case 4: {
                const length = decoder.uint32();
                obj.logs.push(
                  Log.decodeDataView(
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
              case 5: {
                obj.blob_gas_used = decoder.uint64();
                obj.___blob_gas_used = "blob_gas_used";
                obj.___blob_gas_used_index = 5;
                break;
              }
              case 6: {
                const length = decoder.uint32();
                obj.blob_gas_price = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                obj.___blob_gas_price = "blob_gas_price";
                obj.___blob_gas_price_index = 6;
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode TransactionReceipt

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.state_root.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.state_root.length) +
                this.state_root.length
              : 0;
          size +=
            this.cumulative_gas_used == 0
              ? 0
              : 1 + __proto.Sizer.uint64(this.cumulative_gas_used);
          size +=
            this.logs_bloom.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.logs_bloom.length) +
                this.logs_bloom.length
              : 0;

          for (let n: i32 = 0; n < this.logs.length; n++) {
            const messageSize = this.logs[n].size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.blob_gas_used == 0
              ? 0
              : 1 + __proto.Sizer.uint64(this.blob_gas_used);

          if (this.blob_gas_price != null) {
            const f: BigInt = this.blob_gas_price as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes TransactionReceipt to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes TransactionReceipt to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.state_root.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.state_root.length);
            encoder.bytes(this.state_root);
          }
          if (this.cumulative_gas_used != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.cumulative_gas_used);
          }
          if (this.logs_bloom.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.logs_bloom.length);
            encoder.bytes(this.logs_bloom);
          }

          for (let n: i32 = 0; n < this.logs.length; n++) {
            const messageSize = this.logs[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x22);
              encoder.uint32(messageSize);
              this.logs[n].encodeU8Array(encoder);
            }
          }

          if (this.blob_gas_used != 0) {
            encoder.uint32(0x28);
            encoder.uint64(this.blob_gas_used);
          }

          if (this.blob_gas_price != null) {
            const f = this.blob_gas_price as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x32);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode TransactionReceipt
      } // TransactionReceipt

      export class Log {
        public address: Array<u8> = new Array<u8>();
        public topics: Array<Array<u8>> = new Array<Array<u8>>();
        public data: Array<u8> = new Array<u8>();
        /**
         * Index is the index of the log relative to the transaction. This index
         *  is always populated regardless of the state revertion of the the call
         *  that emitted this log.
         *
         *  Only available in DetailLevel: EXTENDED
         */
        public index: u32;
        /**
         * BlockIndex represents the index of the log relative to the Block.
         *
         *  An **important** notice is that this field will be 0 when the call
         *  that emitted the log has been reverted by the chain.
         *
         *  Currently, there is two locations where a Log can be obtained:
         *  - block.transaction_traces[].receipt.logs[]
         *  - block.transaction_traces[].calls[].logs[]
         *
         *  In the `receipt` case, the logs will be populated only when the call
         *  that emitted them has not been reverted by the chain and when in this
         *  position, the `blockIndex` is always populated correctly.
         *
         *  In the case of `calls` case, for `call` where `stateReverted == true`,
         *  the `blockIndex` value will always be 0.
         */
        public blockIndex: u32;
        public ordinal: u64;

        // Decodes Log from an ArrayBuffer
        static decode(buf: ArrayBuffer): Log {
          return Log.decodeDataView(new DataView(buf));
        }

        // Decodes Log from a DataView
        static decodeDataView(view: DataView): Log {
          const decoder = new __proto.Decoder(view);
          const obj = new Log();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.topics.push(decoder.bytes());
                break;
              }
              case 3: {
                obj.data = decoder.bytes();
                break;
              }
              case 4: {
                obj.index = decoder.uint32();
                break;
              }
              case 6: {
                obj.blockIndex = decoder.uint32();
                break;
              }
              case 7: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode Log

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          size += __size_bytes_repeated(this.topics);

          size +=
            this.data.length > 0
              ? 1 + __proto.Sizer.varint64(this.data.length) + this.data.length
              : 0;
          size += this.index == 0 ? 0 : 1 + __proto.Sizer.uint32(this.index);
          size +=
            this.blockIndex == 0
              ? 0
              : 1 + __proto.Sizer.uint32(this.blockIndex);
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes Log to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Log to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }

          if (this.topics.length > 0) {
            for (let n: i32 = 0; n < this.topics.length; n++) {
              encoder.uint32(0x12);
              encoder.uint32(this.topics[n].length);
              encoder.bytes(this.topics[n]);
            }
          }

          if (this.data.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.data.length);
            encoder.bytes(this.data);
          }
          if (this.index != 0) {
            encoder.uint32(0x20);
            encoder.uint32(this.index);
          }
          if (this.blockIndex != 0) {
            encoder.uint32(0x30);
            encoder.uint32(this.blockIndex);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x38);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode Log
      } // Log

      export class Call {
        public index: u32;
        public parent_index: u32;
        public depth: u32;
        public call_type: u32;
        public caller: Array<u8> = new Array<u8>();
        public address: Array<u8> = new Array<u8>();
        public value: BigInt = new BigInt();
        public gas_limit: u64;
        public gas_consumed: u64;
        public return_data: Array<u8> = new Array<u8>();
        public input: Array<u8> = new Array<u8>();
        public executed_code: bool;
        public suicide: bool;
        // hex representation of the hash -> preimage
        public keccak_preimages: Map<string, string> = new Map<
          string,
          string
        >();
        public storage_changes: Array<StorageChange> =
          new Array<StorageChange>();
        public balance_changes: Array<BalanceChange> =
          new Array<BalanceChange>();
        public nonce_changes: Array<NonceChange> = new Array<NonceChange>();
        public logs: Array<Log> = new Array<Log>();
        public code_changes: Array<CodeChange> = new Array<CodeChange>();
        public gas_changes: Array<GasChange> = new Array<GasChange>();
        /**
         * In Ethereum, a call can be either:
         *  - Successfull, execution passes without any problem encountered
         *  - Failed, execution failed, and remaining gas should be consumed
         *  - Reverted, execution failed, but only gas consumed so far is billed, remaining gas is refunded
         *
         *  When a call is either `failed` or `reverted`, the `status_failed` field
         *  below is set to `true`. If the status is `reverted`, then both `status_failed`
         *  and `status_reverted` are going to be set to `true`.
         */
        public status_failed: bool;
        public status_reverted: bool;
        /**
         * Populated when a call either failed or reverted, so when `status_failed == true`,
         *  see above for details about those flags.
         */
        public failure_reason: string = "";
        /**
         * This field represents wheter or not the state changes performed
         *  by this call were correctly recorded by the blockchain.
         *
         *  On Ethereum, a transaction can record state changes even if some
         *  of its inner nested calls failed. This is problematic however since
         *  a call will invalidate all its state changes as well as all state
         *  changes performed by its child call. This means that even if a call
         *  has a status of `SUCCESS`, the chain might have reverted all the state
         *  changes it performed.
         *
         *  ```text
         *    Trx 1
         *     Call #1 <Failed>
         *       Call #2 <Execution Success>
         *       Call #3 <Execution Success>
         *       |--- Failure here
         *     Call #4
         *  ```
         *
         *  In the transaction above, while Call #2 and Call #3 would have the
         *  status `EXECUTED`.
         *
         *  If you check all calls and check only `state_reverted` flag, you might be missing
         *  some balance changes and nonce changes. This is because when a full transaction fails
         *  in ethereum (e.g. `calls.all(x.state_reverted == true)`), there is still the transaction
         *  fee that are recorded to the chain.
         *
         *  Refer to [TransactionTrace#status] field for more details about the handling you must
         *  perform.
         */
        public state_reverted: bool;
        public begin_ordinal: u64;
        public end_ordinal: u64;
        public account_creations: Array<AccountCreation> =
          new Array<AccountCreation>();

        // Decodes Call from an ArrayBuffer
        static decode(buf: ArrayBuffer): Call {
          return Call.decodeDataView(new DataView(buf));
        }

        // Decodes Call from a DataView
        static decodeDataView(view: DataView): Call {
          const decoder = new __proto.Decoder(view);
          const obj = new Call();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.index = decoder.uint32();
                break;
              }
              case 2: {
                obj.parent_index = decoder.uint32();
                break;
              }
              case 3: {
                obj.depth = decoder.uint32();
                break;
              }
              case 4: {
                obj.call_type = decoder.uint32();
                break;
              }
              case 5: {
                obj.caller = decoder.bytes();
                break;
              }
              case 6: {
                obj.address = decoder.bytes();
                break;
              }
              case 7: {
                const length = decoder.uint32();
                obj.value = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 8: {
                obj.gas_limit = decoder.uint64();
                break;
              }
              case 9: {
                obj.gas_consumed = decoder.uint64();
                break;
              }
              case 13: {
                obj.return_data = decoder.bytes();
                break;
              }
              case 14: {
                obj.input = decoder.bytes();
                break;
              }
              case 15: {
                obj.executed_code = decoder.bool();
                break;
              }
              case 16: {
                obj.suicide = decoder.bool();
                break;
              }
              case 20: {
                const length = decoder.uint32();
                __decodeMap_string_string(
                  decoder,
                  length,
                  obj.keccak_preimages
                );
                decoder.skip(length);

                break;
              }
              case 21: {
                const length = decoder.uint32();
                obj.storage_changes.push(
                  StorageChange.decodeDataView(
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
              case 22: {
                const length = decoder.uint32();
                obj.balance_changes.push(
                  BalanceChange.decodeDataView(
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
              case 24: {
                const length = decoder.uint32();
                obj.nonce_changes.push(
                  NonceChange.decodeDataView(
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
              case 25: {
                const length = decoder.uint32();
                obj.logs.push(
                  Log.decodeDataView(
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
              case 26: {
                const length = decoder.uint32();
                obj.code_changes.push(
                  CodeChange.decodeDataView(
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
              case 28: {
                const length = decoder.uint32();
                obj.gas_changes.push(
                  GasChange.decodeDataView(
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
              case 10: {
                obj.status_failed = decoder.bool();
                break;
              }
              case 12: {
                obj.status_reverted = decoder.bool();
                break;
              }
              case 11: {
                obj.failure_reason = decoder.string();
                break;
              }
              case 30: {
                obj.state_reverted = decoder.bool();
                break;
              }
              case 31: {
                obj.begin_ordinal = decoder.uint64();
                break;
              }
              case 32: {
                obj.end_ordinal = decoder.uint64();
                break;
              }
              case 33: {
                const length = decoder.uint32();
                obj.account_creations.push(
                  AccountCreation.decodeDataView(
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
        } // decode Call

        public size(): u32 {
          let size: u32 = 0;

          size += this.index == 0 ? 0 : 1 + __proto.Sizer.uint32(this.index);
          size +=
            this.parent_index == 0
              ? 0
              : 1 + __proto.Sizer.uint32(this.parent_index);
          size += this.depth == 0 ? 0 : 1 + __proto.Sizer.uint32(this.depth);
          size +=
            this.call_type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.call_type);
          size +=
            this.caller.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.caller.length) +
                this.caller.length
              : 0;
          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          if (this.value != null) {
            const f: BigInt = this.value as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size +=
            this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);
          size +=
            this.gas_consumed == 0
              ? 0
              : 1 + __proto.Sizer.uint64(this.gas_consumed);
          size +=
            this.return_data.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.return_data.length) +
                this.return_data.length
              : 0;
          size +=
            this.input.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.input.length) +
                this.input.length
              : 0;
          size += this.executed_code == 0 ? 0 : 1 + 1;
          size += this.suicide == 0 ? 0 : 2 + 1;

          if (this.keccak_preimages.size > 0) {
            const keys = this.keccak_preimages.keys();

            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              const value = this.keccak_preimages.get(key);
              const itemSize = __sizeMapEntry_string_string(key, value);
              if (itemSize > 0) {
                size += 2 + __proto.Sizer.varint64(itemSize) + itemSize;
              }
            }
          }

          for (let n: i32 = 0; n < this.storage_changes.length; n++) {
            const messageSize = this.storage_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.balance_changes.length; n++) {
            const messageSize = this.balance_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.nonce_changes.length; n++) {
            const messageSize = this.nonce_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.logs.length; n++) {
            const messageSize = this.logs[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.code_changes.length; n++) {
            const messageSize = this.code_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          for (let n: i32 = 0; n < this.gas_changes.length; n++) {
            const messageSize = this.gas_changes[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.status_failed == 0 ? 0 : 1 + 1;
          size += this.status_reverted == 0 ? 0 : 1 + 1;
          size +=
            this.failure_reason.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.failure_reason.length) +
                this.failure_reason.length
              : 0;
          size += this.state_reverted == 0 ? 0 : 2 + 1;
          size +=
            this.begin_ordinal == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.begin_ordinal);
          size +=
            this.end_ordinal == 0
              ? 0
              : 2 + __proto.Sizer.uint64(this.end_ordinal);

          for (let n: i32 = 0; n < this.account_creations.length; n++) {
            const messageSize = this.account_creations[n].size();

            if (messageSize > 0) {
              size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes Call to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes Call to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.index != 0) {
            encoder.uint32(0x8);
            encoder.uint32(this.index);
          }
          if (this.parent_index != 0) {
            encoder.uint32(0x10);
            encoder.uint32(this.parent_index);
          }
          if (this.depth != 0) {
            encoder.uint32(0x18);
            encoder.uint32(this.depth);
          }
          if (this.call_type != 0) {
            encoder.uint32(0x20);
            encoder.uint32(this.call_type);
          }
          if (this.caller.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.caller.length);
            encoder.bytes(this.caller);
          }
          if (this.address.length > 0) {
            encoder.uint32(0x32);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }

          if (this.value != null) {
            const f = this.value as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x3a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.gas_limit != 0) {
            encoder.uint32(0x40);
            encoder.uint64(this.gas_limit);
          }
          if (this.gas_consumed != 0) {
            encoder.uint32(0x48);
            encoder.uint64(this.gas_consumed);
          }
          if (this.return_data.length > 0) {
            encoder.uint32(0x6a);
            encoder.uint32(this.return_data.length);
            encoder.bytes(this.return_data);
          }
          if (this.input.length > 0) {
            encoder.uint32(0x72);
            encoder.uint32(this.input.length);
            encoder.bytes(this.input);
          }
          if (this.executed_code != 0) {
            encoder.uint32(0x78);
            encoder.bool(this.executed_code);
          }
          if (this.suicide != 0) {
            encoder.uint32(0x80);
            encoder.bool(this.suicide);
          }

          if (this.keccak_preimages.size > 0) {
            const keys = this.keccak_preimages.keys();
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              const value = this.keccak_preimages.get(key);
              const size = __sizeMapEntry_string_string(key, value);
              if (size > 0) {
                encoder.uint32(0xa2);
                encoder.uint32(size);
                if (key.length > 0) {
                  encoder.uint32(0xa);
                  encoder.uint32(key.length);
                  encoder.string(key);
                }
                if (value.length > 0) {
                  encoder.uint32(0x12);
                  encoder.uint32(value.length);
                  encoder.string(value);
                }
              }
            }
          }

          for (let n: i32 = 0; n < this.storage_changes.length; n++) {
            const messageSize = this.storage_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xaa);
              encoder.uint32(messageSize);
              this.storage_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.balance_changes.length; n++) {
            const messageSize = this.balance_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xb2);
              encoder.uint32(messageSize);
              this.balance_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.nonce_changes.length; n++) {
            const messageSize = this.nonce_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xc2);
              encoder.uint32(messageSize);
              this.nonce_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.logs.length; n++) {
            const messageSize = this.logs[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xca);
              encoder.uint32(messageSize);
              this.logs[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.code_changes.length; n++) {
            const messageSize = this.code_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xd2);
              encoder.uint32(messageSize);
              this.code_changes[n].encodeU8Array(encoder);
            }
          }

          for (let n: i32 = 0; n < this.gas_changes.length; n++) {
            const messageSize = this.gas_changes[n].size();

            if (messageSize > 0) {
              encoder.uint32(0xe2);
              encoder.uint32(messageSize);
              this.gas_changes[n].encodeU8Array(encoder);
            }
          }

          if (this.status_failed != 0) {
            encoder.uint32(0x50);
            encoder.bool(this.status_failed);
          }
          if (this.status_reverted != 0) {
            encoder.uint32(0x60);
            encoder.bool(this.status_reverted);
          }
          if (this.failure_reason.length > 0) {
            encoder.uint32(0x5a);
            encoder.uint32(this.failure_reason.length);
            encoder.string(this.failure_reason);
          }
          if (this.state_reverted != 0) {
            encoder.uint32(0xf0);
            encoder.bool(this.state_reverted);
          }
          if (this.begin_ordinal != 0) {
            encoder.uint32(0xf8);
            encoder.uint64(this.begin_ordinal);
          }
          if (this.end_ordinal != 0) {
            encoder.uint32(0x100);
            encoder.uint64(this.end_ordinal);
          }

          for (let n: i32 = 0; n < this.account_creations.length; n++) {
            const messageSize = this.account_creations[n].size();

            if (messageSize > 0) {
              encoder.uint32(0x10a);
              encoder.uint32(messageSize);
              this.account_creations[n].encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode Call
      } // Call

      export class StorageChange {
        public address: Array<u8> = new Array<u8>();
        public key: Array<u8> = new Array<u8>();
        public old_value: Array<u8> = new Array<u8>();
        public new_value: Array<u8> = new Array<u8>();
        public ordinal: u64;

        // Decodes StorageChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): StorageChange {
          return StorageChange.decodeDataView(new DataView(buf));
        }

        // Decodes StorageChange from a DataView
        static decodeDataView(view: DataView): StorageChange {
          const decoder = new __proto.Decoder(view);
          const obj = new StorageChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.key = decoder.bytes();
                break;
              }
              case 3: {
                obj.old_value = decoder.bytes();
                break;
              }
              case 4: {
                obj.new_value = decoder.bytes();
                break;
              }
              case 5: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode StorageChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;
          size +=
            this.key.length > 0
              ? 1 + __proto.Sizer.varint64(this.key.length) + this.key.length
              : 0;
          size +=
            this.old_value.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.old_value.length) +
                this.old_value.length
              : 0;
          size +=
            this.new_value.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.new_value.length) +
                this.new_value.length
              : 0;
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes StorageChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes StorageChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }
          if (this.key.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.key.length);
            encoder.bytes(this.key);
          }
          if (this.old_value.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.old_value.length);
            encoder.bytes(this.old_value);
          }
          if (this.new_value.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.new_value.length);
            encoder.bytes(this.new_value);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x28);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode StorageChange
      } // StorageChange

      export class BalanceChange {
        public address: Array<u8> = new Array<u8>();
        public old_value: BigInt = new BigInt();
        public new_value: BigInt = new BigInt();
        public reason: u32;
        public ordinal: u64;

        // Decodes BalanceChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): BalanceChange {
          return BalanceChange.decodeDataView(new DataView(buf));
        }

        // Decodes BalanceChange from a DataView
        static decodeDataView(view: DataView): BalanceChange {
          const decoder = new __proto.Decoder(view);
          const obj = new BalanceChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                const length = decoder.uint32();
                obj.old_value = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 3: {
                const length = decoder.uint32();
                obj.new_value = BigInt.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 4: {
                obj.reason = decoder.uint32();
                break;
              }
              case 5: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BalanceChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;

          if (this.old_value != null) {
            const f: BigInt = this.old_value as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.new_value != null) {
            const f: BigInt = this.new_value as BigInt;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.reason == 0 ? 0 : 1 + __proto.Sizer.uint32(this.reason);
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes BalanceChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BalanceChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }

          if (this.old_value != null) {
            const f = this.old_value as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x12);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.new_value != null) {
            const f = this.new_value as BigInt;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.reason != 0) {
            encoder.uint32(0x20);
            encoder.uint32(this.reason);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x28);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode BalanceChange
      } // BalanceChange

      /**
       * Obtain all balanche change reasons under deep mind repository:
       *
       *  ```shell
       *  ack -ho 'BalanceChangeReason\(".*"\)' | grep -Eo '".*"' | sort | uniq
       *  ```
       */
      export enum BalanceChange_Reason {
        REASON_UNKNOWN = 0,
        REASON_REWARD_MINE_UNCLE = 1,
        REASON_REWARD_MINE_BLOCK = 2,
        REASON_DAO_REFUND_CONTRACT = 3,
        REASON_DAO_ADJUST_BALANCE = 4,
        REASON_TRANSFER = 5,
        REASON_GENESIS_BALANCE = 6,
        REASON_GAS_BUY = 7,
        REASON_REWARD_TRANSACTION_FEE = 8,
        REASON_REWARD_FEE_RESET = 14,
        REASON_GAS_REFUND = 9,
        REASON_TOUCH_ACCOUNT = 10,
        REASON_SUICIDE_REFUND = 11,
        REASON_SUICIDE_WITHDRAW = 13,
        REASON_CALL_BALANCE_OVERRIDE = 12,
        // Used on chain(s) where some Ether burning happens
        REASON_BURN = 15,
        REASON_WITHDRAWAL = 16,
      } // BalanceChange_Reason
      export class NonceChange {
        public address: Array<u8> = new Array<u8>();
        public old_value: u64;
        public new_value: u64;
        public ordinal: u64;

        // Decodes NonceChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): NonceChange {
          return NonceChange.decodeDataView(new DataView(buf));
        }

        // Decodes NonceChange from a DataView
        static decodeDataView(view: DataView): NonceChange {
          const decoder = new __proto.Decoder(view);
          const obj = new NonceChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.old_value = decoder.uint64();
                break;
              }
              case 3: {
                obj.new_value = decoder.uint64();
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
        } // decode NonceChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;
          size +=
            this.old_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.old_value);
          size +=
            this.new_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.new_value);
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes NonceChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes NonceChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }
          if (this.old_value != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.old_value);
          }
          if (this.new_value != 0) {
            encoder.uint32(0x18);
            encoder.uint64(this.new_value);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x20);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode NonceChange
      } // NonceChange

      export class AccountCreation {
        public account: Array<u8> = new Array<u8>();
        public ordinal: u64;

        // Decodes AccountCreation from an ArrayBuffer
        static decode(buf: ArrayBuffer): AccountCreation {
          return AccountCreation.decodeDataView(new DataView(buf));
        }

        // Decodes AccountCreation from a DataView
        static decodeDataView(view: DataView): AccountCreation {
          const decoder = new __proto.Decoder(view);
          const obj = new AccountCreation();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.account = decoder.bytes();
                break;
              }
              case 2: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode AccountCreation

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.account.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.account.length) +
                this.account.length
              : 0;
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes AccountCreation to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes AccountCreation to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.account.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.account.length);
            encoder.bytes(this.account);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode AccountCreation
      } // AccountCreation

      export class CodeChange {
        public address: Array<u8> = new Array<u8>();
        public old_hash: Array<u8> = new Array<u8>();
        public old_code: Array<u8> = new Array<u8>();
        public new_hash: Array<u8> = new Array<u8>();
        public new_code: Array<u8> = new Array<u8>();
        public ordinal: u64;

        // Decodes CodeChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): CodeChange {
          return CodeChange.decodeDataView(new DataView(buf));
        }

        // Decodes CodeChange from a DataView
        static decodeDataView(view: DataView): CodeChange {
          const decoder = new __proto.Decoder(view);
          const obj = new CodeChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.address = decoder.bytes();
                break;
              }
              case 2: {
                obj.old_hash = decoder.bytes();
                break;
              }
              case 3: {
                obj.old_code = decoder.bytes();
                break;
              }
              case 4: {
                obj.new_hash = decoder.bytes();
                break;
              }
              case 5: {
                obj.new_code = decoder.bytes();
                break;
              }
              case 6: {
                obj.ordinal = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode CodeChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.address.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.address.length) +
                this.address.length
              : 0;
          size +=
            this.old_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.old_hash.length) +
                this.old_hash.length
              : 0;
          size +=
            this.old_code.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.old_code.length) +
                this.old_code.length
              : 0;
          size +=
            this.new_hash.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.new_hash.length) +
                this.new_hash.length
              : 0;
          size +=
            this.new_code.length > 0
              ? 1 +
                __proto.Sizer.varint64(this.new_code.length) +
                this.new_code.length
              : 0;
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes CodeChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes CodeChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.address.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.address.length);
            encoder.bytes(this.address);
          }
          if (this.old_hash.length > 0) {
            encoder.uint32(0x12);
            encoder.uint32(this.old_hash.length);
            encoder.bytes(this.old_hash);
          }
          if (this.old_code.length > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(this.old_code.length);
            encoder.bytes(this.old_code);
          }
          if (this.new_hash.length > 0) {
            encoder.uint32(0x22);
            encoder.uint32(this.new_hash.length);
            encoder.bytes(this.new_hash);
          }
          if (this.new_code.length > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(this.new_code.length);
            encoder.bytes(this.new_code);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x30);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode CodeChange
      } // CodeChange

      /**
       * The gas change model represents the reason why some gas cost has occurred.
       *  The gas is computed per actual op codes. Doing them completely might prove
       *  overwhelming in most cases.
       *
       *  Hence, we only index some of them, those that are costy like all the calls
       *  one, log events, return data, etc.
       */
      export class GasChange {
        public old_value: u64;
        public new_value: u64;
        public reason: u32;
        public ordinal: u64;

        // Decodes GasChange from an ArrayBuffer
        static decode(buf: ArrayBuffer): GasChange {
          return GasChange.decodeDataView(new DataView(buf));
        }

        // Decodes GasChange from a DataView
        static decodeDataView(view: DataView): GasChange {
          const decoder = new __proto.Decoder(view);
          const obj = new GasChange();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.old_value = decoder.uint64();
                break;
              }
              case 2: {
                obj.new_value = decoder.uint64();
                break;
              }
              case 3: {
                obj.reason = decoder.uint32();
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
        } // decode GasChange

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.old_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.old_value);
          size +=
            this.new_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.new_value);
          size += this.reason == 0 ? 0 : 1 + __proto.Sizer.uint32(this.reason);
          size +=
            this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

          return size;
        }

        // Encodes GasChange to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes GasChange to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.old_value != 0) {
            encoder.uint32(0x8);
            encoder.uint64(this.old_value);
          }
          if (this.new_value != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.new_value);
          }
          if (this.reason != 0) {
            encoder.uint32(0x18);
            encoder.uint32(this.reason);
          }
          if (this.ordinal != 0) {
            encoder.uint32(0x20);
            encoder.uint64(this.ordinal);
          }

          return buf;
        } // encode GasChange
      } // GasChange

      /**
       * Obtain all gas change reasons under deep mind repository:
       *
       *  ```shell
       *  ack -ho 'GasChangeReason\(".*"\)' | grep -Eo '".*"' | sort | uniq
       *  ```
       */
      export enum GasChange_Reason {
        REASON_UNKNOWN = 0,
        // REASON_CALL is the amount of gas that will be charged for a 'CALL' opcode executed by the EVM
        REASON_CALL = 1,
        // REASON_CALL_CODE is the amount of gas that will be charged for a 'CALLCODE' opcode executed by the EVM
        REASON_CALL_CODE = 2,
        // REASON_CALL_DATA_COPY is the amount of gas that will be charged for a 'CALLDATACOPY' opcode executed by the EVM
        REASON_CALL_DATA_COPY = 3,
        // REASON_CODE_COPY is the amount of gas that will be charged for a 'CALLDATACOPY' opcode executed by the EVM
        REASON_CODE_COPY = 4,
        // REASON_CODE_STORAGE is the amount of gas that will be charged for code storage
        REASON_CODE_STORAGE = 5,
        /**
         * REASON_CONTRACT_CREATION is the amount of gas that will be charged for a 'CREATE' opcode executed by the EVM and for the gas
         *  burned for a CREATE, today controlled by EIP150 rules
         */
        REASON_CONTRACT_CREATION = 6,
        /**
         * REASON_CONTRACT_CREATION2 is the amount of gas that will be charged for a 'CREATE2' opcode executed by the EVM and for the gas
         *  burned for a CREATE2, today controlled by EIP150 rules
         */
        REASON_CONTRACT_CREATION2 = 7,
        // REASON_DELEGATE_CALL is the amount of gas that will be charged for a 'DELEGATECALL' opcode executed by the EVM
        REASON_DELEGATE_CALL = 8,
        // REASON_EVENT_LOG is the amount of gas that will be charged for a 'LOG<N>' opcode executed by the EVM
        REASON_EVENT_LOG = 9,
        // REASON_EXT_CODE_COPY is the amount of gas that will be charged for a 'LOG<N>' opcode executed by the EVM
        REASON_EXT_CODE_COPY = 10,
        // REASON_FAILED_EXECUTION is the burning of the remaining gas when the execution failed without a revert
        REASON_FAILED_EXECUTION = 11,
        /**
         * REASON_INTRINSIC_GAS is the amount of gas that will be charged for the intrinsic cost of the transaction, there is
         *  always exactly one of those per transaction
         */
        REASON_INTRINSIC_GAS = 12,
        // GasChangePrecompiledContract is the amount of gas that will be charged for a precompiled contract execution
        REASON_PRECOMPILED_CONTRACT = 13,
        /**
         * REASON_REFUND_AFTER_EXECUTION is the amount of gas that will be refunded to the caller after the execution of the call,
         *  if there is left over at the end of execution
         */
        REASON_REFUND_AFTER_EXECUTION = 14,
        // REASON_RETURN is the amount of gas that will be charged for a 'RETURN' opcode executed by the EVM
        REASON_RETURN = 15,
        // REASON_RETURN_DATA_COPY is the amount of gas that will be charged for a 'RETURNDATACOPY' opcode executed by the EVM
        REASON_RETURN_DATA_COPY = 16,
        // REASON_REVERT is the amount of gas that will be charged for a 'REVERT' opcode executed by the EVM
        REASON_REVERT = 17,
        // REASON_SELF_DESTRUCT is the amount of gas that will be charged for a 'SELFDESTRUCT' opcode executed by the EVM
        REASON_SELF_DESTRUCT = 18,
        // REASON_STATIC_CALL is the amount of gas that will be charged for a 'STATICALL' opcode executed by the EVM
        REASON_STATIC_CALL = 19,
        /**
         * REASON_STATE_COLD_ACCESS is the amount of gas that will be charged for a cold storage access as controlled by EIP2929 rules
         *
         *  Added in Berlin fork (Geth 1.10+)
         */
        REASON_STATE_COLD_ACCESS = 20,
        /**
         * REASON_TX_INITIAL_BALANCE is the initial balance for the call which will be equal to the gasLimit of the call
         *
         *  Added as new tracing reason in Geth, available only on some chains
         */
        REASON_TX_INITIAL_BALANCE = 21,
        /**
         * REASON_TX_REFUNDS is the sum of all refunds which happened during the tx execution (e.g. storage slot being cleared)
         *  this generates an increase in gas. There is only one such gas change per transaction.
         *
         *  Added as new tracing reason in Geth, available only on some chains
         */
        REASON_TX_REFUNDS = 22,
        /**
         * REASON_TX_LEFT_OVER_RETURNED is the amount of gas left over at the end of transaction's execution that will be returned
         *  to the chain. This change will always be a negative change as we "drain" left over gas towards 0. If there was no gas
         *  left at the end of execution, no such even will be emitted. The returned gas's value in Wei is returned to caller.
         *  There is at most one of such gas change per transaction.
         *
         *  Added as new tracing reason in Geth, available only on some chains
         */
        REASON_TX_LEFT_OVER_RETURNED = 23,
        /**
         * REASON_CALL_INITIAL_BALANCE is the initial balance for the call which will be equal to the gasLimit of the call. There is only
         *  one such gas change per call.
         *
         *  Added as new tracing reason in Geth, available only on some chains
         */
        REASON_CALL_INITIAL_BALANCE = 24,
        /**
         * REASON_CALL_LEFT_OVER_RETURNED is the amount of gas left over that will be returned to the caller, this change will always
         *  be a negative change as we "drain" left over gas towards 0. If there was no gas left at the end of execution, no such even
         *  will be emitted.
         */
        REASON_CALL_LEFT_OVER_RETURNED = 25,
      } // GasChange_Reason
      /**
       * HeaderOnlyBlock is used to optimally unpack the [Block] structure (note the
       *  corresponding message number for the `header` field) while consuming less
       *  memory, when only the `header` is desired.
       *
       *  WARN: this is a client-side optimization pattern and should be moved in the
       *  consuming code.
       */
      export class HeaderOnlyBlock {
        public header: BlockHeader = new BlockHeader();

        // Decodes HeaderOnlyBlock from an ArrayBuffer
        static decode(buf: ArrayBuffer): HeaderOnlyBlock {
          return HeaderOnlyBlock.decodeDataView(new DataView(buf));
        }

        // Decodes HeaderOnlyBlock from a DataView
        static decodeDataView(view: DataView): HeaderOnlyBlock {
          const decoder = new __proto.Decoder(view);
          const obj = new HeaderOnlyBlock();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 5: {
                const length = decoder.uint32();
                obj.header = BlockHeader.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
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
        } // decode HeaderOnlyBlock

        public size(): u32 {
          let size: u32 = 0;

          if (this.header != null) {
            const f: BlockHeader = this.header as BlockHeader;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes HeaderOnlyBlock to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes HeaderOnlyBlock to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.header != null) {
            const f = this.header as BlockHeader;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x2a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode HeaderOnlyBlock
      } // HeaderOnlyBlock

      /**
       * BlockWithRefs is a lightweight block, with traces and transactions
       *  purged from the `block` within, and only.  It is used in transports
       *  to pass block data around.
       */
      export class BlockWithRefs {
        public id: string = "";
        public block: Block = new Block();
        public transaction_trace_refs: TransactionRefs = new TransactionRefs();
        public irreversible: bool;

        // Decodes BlockWithRefs from an ArrayBuffer
        static decode(buf: ArrayBuffer): BlockWithRefs {
          return BlockWithRefs.decodeDataView(new DataView(buf));
        }

        // Decodes BlockWithRefs from a DataView
        static decodeDataView(view: DataView): BlockWithRefs {
          const decoder = new __proto.Decoder(view);
          const obj = new BlockWithRefs();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.id = decoder.string();
                break;
              }
              case 2: {
                const length = decoder.uint32();
                obj.block = Block.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 3: {
                const length = decoder.uint32();
                obj.transaction_trace_refs = TransactionRefs.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 4: {
                obj.irreversible = decoder.bool();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BlockWithRefs

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.id.length > 0
              ? 1 + __proto.Sizer.varint64(this.id.length) + this.id.length
              : 0;

          if (this.block != null) {
            const f: Block = this.block as Block;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.transaction_trace_refs != null) {
            const f: TransactionRefs = this
              .transaction_trace_refs as TransactionRefs;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          size += this.irreversible == 0 ? 0 : 1 + 1;

          return size;
        }

        // Encodes BlockWithRefs to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BlockWithRefs to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.id.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.id.length);
            encoder.string(this.id);
          }

          if (this.block != null) {
            const f = this.block as Block;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x12);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.transaction_trace_refs != null) {
            const f = this.transaction_trace_refs as TransactionRefs;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x1a);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.irreversible != 0) {
            encoder.uint32(0x20);
            encoder.bool(this.irreversible);
          }

          return buf;
        } // encode BlockWithRefs
      } // BlockWithRefs

      export class TransactionTraceWithBlockRef {
        public trace: TransactionTrace = new TransactionTrace();
        public block_ref: BlockRef = new BlockRef();

        // Decodes TransactionTraceWithBlockRef from an ArrayBuffer
        static decode(buf: ArrayBuffer): TransactionTraceWithBlockRef {
          return TransactionTraceWithBlockRef.decodeDataView(new DataView(buf));
        }

        // Decodes TransactionTraceWithBlockRef from a DataView
        static decodeDataView(view: DataView): TransactionTraceWithBlockRef {
          const decoder = new __proto.Decoder(view);
          const obj = new TransactionTraceWithBlockRef();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                const length = decoder.uint32();
                obj.trace = TransactionTrace.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
                  )
                );
                decoder.skip(length);

                break;
              }
              case 2: {
                const length = decoder.uint32();
                obj.block_ref = BlockRef.decodeDataView(
                  new DataView(
                    decoder.view.buffer,
                    decoder.pos + decoder.view.byteOffset,
                    length
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
        } // decode TransactionTraceWithBlockRef

        public size(): u32 {
          let size: u32 = 0;

          if (this.trace != null) {
            const f: TransactionTrace = this.trace as TransactionTrace;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          if (this.block_ref != null) {
            const f: BlockRef = this.block_ref as BlockRef;
            const messageSize = f.size();

            if (messageSize > 0) {
              size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
            }
          }

          return size;
        }

        // Encodes TransactionTraceWithBlockRef to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes TransactionTraceWithBlockRef to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.trace != null) {
            const f = this.trace as TransactionTrace;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0xa);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          if (this.block_ref != null) {
            const f = this.block_ref as BlockRef;

            const messageSize = f.size();

            if (messageSize > 0) {
              encoder.uint32(0x12);
              encoder.uint32(messageSize);
              f.encodeU8Array(encoder);
            }
          }

          return buf;
        } // encode TransactionTraceWithBlockRef
      } // TransactionTraceWithBlockRef

      export class TransactionRefs {
        public hashes: Array<Array<u8>> = new Array<Array<u8>>();

        // Decodes TransactionRefs from an ArrayBuffer
        static decode(buf: ArrayBuffer): TransactionRefs {
          return TransactionRefs.decodeDataView(new DataView(buf));
        }

        // Decodes TransactionRefs from a DataView
        static decodeDataView(view: DataView): TransactionRefs {
          const decoder = new __proto.Decoder(view);
          const obj = new TransactionRefs();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.hashes.push(decoder.bytes());
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode TransactionRefs

        public size(): u32 {
          let size: u32 = 0;

          size += __size_bytes_repeated(this.hashes);

          return size;
        }

        // Encodes TransactionRefs to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes TransactionRefs to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.hashes.length > 0) {
            for (let n: i32 = 0; n < this.hashes.length; n++) {
              encoder.uint32(0xa);
              encoder.uint32(this.hashes[n].length);
              encoder.bytes(this.hashes[n]);
            }
          }

          return buf;
        } // encode TransactionRefs
      } // TransactionRefs

      export class BlockRef {
        public hash: Array<u8> = new Array<u8>();
        public number: u64;

        // Decodes BlockRef from an ArrayBuffer
        static decode(buf: ArrayBuffer): BlockRef {
          return BlockRef.decodeDataView(new DataView(buf));
        }

        // Decodes BlockRef from a DataView
        static decodeDataView(view: DataView): BlockRef {
          const decoder = new __proto.Decoder(view);
          const obj = new BlockRef();

          while (!decoder.eof()) {
            const tag = decoder.tag();
            const number = tag >>> 3;

            switch (number) {
              case 1: {
                obj.hash = decoder.bytes();
                break;
              }
              case 2: {
                obj.number = decoder.uint64();
                break;
              }

              default:
                decoder.skipType(tag & 7);
                break;
            }
          }
          return obj;
        } // decode BlockRef

        public size(): u32 {
          let size: u32 = 0;

          size +=
            this.hash.length > 0
              ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
              : 0;
          size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);

          return size;
        }

        // Encodes BlockRef to the ArrayBuffer
        encode(): ArrayBuffer {
          return changetype<ArrayBuffer>(
            StaticArray.fromArray<u8>(this.encodeU8Array())
          );
        }

        // Encodes BlockRef to the Array<u8>
        encodeU8Array(
          encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
        ): Array<u8> {
          const buf = encoder.buf;

          if (this.hash.length > 0) {
            encoder.uint32(0xa);
            encoder.uint32(this.hash.length);
            encoder.bytes(this.hash);
          }
          if (this.number != 0) {
            encoder.uint32(0x10);
            encoder.uint64(this.number);
          }

          return buf;
        } // encode BlockRef
      } // BlockRef
    } // v2
  } // type
  export namespace v2 {
    export enum TransactionTraceStatus {
      UNKNOWN = 0,
      SUCCEEDED = 1,
      FAILED = 2,
      REVERTED = 3,
    } // TransactionTraceStatus
    export enum CallType {
      UNSPECIFIED = 0,
      // direct? what's the name for `Call` alone?
      CALL = 1,
      CALLCODE = 2,
      DELEGATE = 3,
      STATIC = 4,
      // create2 ? any other form of calls?
      CREATE = 5,
    } // CallType
    export class Block {
      // Hash is the block's hash.
      public hash: Array<u8> = new Array<u8>();
      // Number is the block's height at which this block was mined.
      public number: u64;
      /**
       * Size is the size in bytes of the RLP encoding of the block according to Ethereum
       *  rules.
       * uint64 size = 4;
       *  Header contain's the block's header information like its parent hash, the merkel root hash
       *  and all other information the form a block.
       */
      public header: BlockHeader = new BlockHeader();
      /**
       * Uncles represents block produced with a valid solution but were not actually choosen
       *  as the canonical block for the given height so they are mostly "forked" blocks.
       *
       *  If the Block has been produced using the Proof of Stake consensus algorithm, this
       *  field will actually be always empty.
       */
      public uncles: Array<BlockHeader> = new Array<BlockHeader>();
      /**
       * TransactionTraces hold the execute trace of all the transactions that were executed
       *  in this block. In in there that you will find most of the Ethereum data model.
       *
       *  They are ordered by the order of execution of the transaction in the block.
       */
      public transaction_traces: Array<TransactionTrace> =
        new Array<TransactionTrace>();
      /**
       * BalanceChanges here is the array of ETH transfer that happened at the block level
       *  outside of the normal transaction flow of a block. The best example of this is mining
       *  reward for the block mined, the transfer of ETH to the miner happens outside the normal
       *  transaction flow of the chain and is recorded as a `BalanceChange` here since we cannot
       *  attached it to any transaction.
       *
       *  Only available in DetailLevel: EXTENDED
       */
      public balance_changes: Array<BalanceChange> = new Array<BalanceChange>();
      /**
       * DetailLevel affects the data available in this block.
       *
       *  EXTENDED describes the most complete block, with traces, balance changes, storage changes. It is extracted during the execution of the block.
       *  BASE describes a block that contains only the block header, transaction receipts and event logs: everything that can be extracted using the base JSON-RPC interface (https://ethereum.org/en/developers/docs/apis/json-rpc/#json-rpc-methods)
       *       Furthermore, the eth_getTransactionReceipt call has been avoided because it brings only minimal improvements at the cost of requiring an archive node or a full node with complete transaction index.
       */
      public detail_level: u32;
      /**
       * CodeChanges here is the array of smart code change that happened that happened at the block level
       *  outside of the normal transaction flow of a block. Some Ethereum's fork like BSC and Polygon
       *  has some capabilities to upgrade internal smart contracts used usually to track the validator
       *  list.
       *
       *  On hard fork, some procedure runs to upgrade the smart contract code to a new version. In those
       *  network, a `CodeChange` for each modified smart contract on upgrade would be present here. Note
       *  that this happen rarely, so the vast majority of block will have an empty list here.
       *  Only available in DetailLevel: EXTENDED
       */
      public code_changes: Array<CodeChange> = new Array<CodeChange>();
      /**
       * System calls are introduced in Cancun, along with blobs. They are executed outside of transactions but affect the state.
       *  Only available in DetailLevel: EXTENDED
       */
      public system_calls: Array<Call> = new Array<Call>();
      /**
       * Ver represents that data model version of the block, it is used internally by Firehose on Ethereum
       *  as a validation that we are reading the correct version.
       */
      public ver: i32;

      // Decodes Block from an ArrayBuffer
      static decode(buf: ArrayBuffer): Block {
        return Block.decodeDataView(new DataView(buf));
      }

      // Decodes Block from a DataView
      static decodeDataView(view: DataView): Block {
        const decoder = new __proto.Decoder(view);
        const obj = new Block();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 2: {
              obj.hash = decoder.bytes();
              break;
            }
            case 3: {
              obj.number = decoder.uint64();
              break;
            }
            case 5: {
              const length = decoder.uint32();
              obj.header = BlockHeader.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 6: {
              const length = decoder.uint32();
              obj.uncles.push(
                BlockHeader.decodeDataView(
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
            case 10: {
              const length = decoder.uint32();
              obj.transaction_traces.push(
                TransactionTrace.decodeDataView(
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
            case 11: {
              const length = decoder.uint32();
              obj.balance_changes.push(
                BalanceChange.decodeDataView(
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
            case 12: {
              obj.detail_level = decoder.uint32();
              break;
            }
            case 20: {
              const length = decoder.uint32();
              obj.code_changes.push(
                CodeChange.decodeDataView(
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
            case 21: {
              const length = decoder.uint32();
              obj.system_calls.push(
                Call.decodeDataView(
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
            case 1: {
              obj.ver = decoder.int32();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Block

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.hash.length > 0
            ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
            : 0;
        size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);

        if (this.header != null) {
          const f: BlockHeader = this.header as BlockHeader;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.uncles.length; n++) {
          const messageSize = this.uncles[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.transaction_traces.length; n++) {
          const messageSize = this.transaction_traces[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.balance_changes.length; n++) {
          const messageSize = this.balance_changes[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.detail_level == 0
            ? 0
            : 1 + __proto.Sizer.uint32(this.detail_level);

        for (let n: i32 = 0; n < this.code_changes.length; n++) {
          const messageSize = this.code_changes[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.system_calls.length; n++) {
          const messageSize = this.system_calls[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size += this.ver == 0 ? 0 : 1 + __proto.Sizer.int32(this.ver);

        return size;
      }

      // Encodes Block to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Block to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.hash.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.hash.length);
          encoder.bytes(this.hash);
        }
        if (this.number != 0) {
          encoder.uint32(0x18);
          encoder.uint64(this.number);
        }

        if (this.header != null) {
          const f = this.header as BlockHeader;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.uncles.length; n++) {
          const messageSize = this.uncles[n].size();

          if (messageSize > 0) {
            encoder.uint32(0x32);
            encoder.uint32(messageSize);
            this.uncles[n].encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.transaction_traces.length; n++) {
          const messageSize = this.transaction_traces[n].size();

          if (messageSize > 0) {
            encoder.uint32(0x52);
            encoder.uint32(messageSize);
            this.transaction_traces[n].encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.balance_changes.length; n++) {
          const messageSize = this.balance_changes[n].size();

          if (messageSize > 0) {
            encoder.uint32(0x5a);
            encoder.uint32(messageSize);
            this.balance_changes[n].encodeU8Array(encoder);
          }
        }

        if (this.detail_level != 0) {
          encoder.uint32(0x60);
          encoder.uint32(this.detail_level);
        }

        for (let n: i32 = 0; n < this.code_changes.length; n++) {
          const messageSize = this.code_changes[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xa2);
            encoder.uint32(messageSize);
            this.code_changes[n].encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.system_calls.length; n++) {
          const messageSize = this.system_calls[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xaa);
            encoder.uint32(messageSize);
            this.system_calls[n].encodeU8Array(encoder);
          }
        }

        if (this.ver != 0) {
          encoder.uint32(0x8);
          encoder.int32(this.ver);
        }

        return buf;
      } // encode Block
    } // Block

    export enum Block_DetailLevel {
      DETAILLEVEL_EXTENDED = 0,
      // DETAILLEVEL_TRACE = 1; // TBD
      DETAILLEVEL_BASE = 2,
    } // Block_DetailLevel
    /**
     * BlockWithRefs is a lightweight block, with traces and transactions
     *  purged from the `block` within, and only.  It is used in transports
     *  to pass block data around.
     */
    export class BlockHeader {
      public parent_hash: Array<u8> = new Array<u8>();
      /**
       * Uncle hash of the block, some reference it as `sha3Uncles`, but `sha3`` is badly worded, so we prefer `uncle_hash`, also
       *  referred as `ommers` in EIP specification.
       *
       *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
       *  consensus algorithm, this field will actually be constant and set to `0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347`.
       */
      public uncle_hash: Array<u8> = new Array<u8>();
      public coinbase: Array<u8> = new Array<u8>();
      public state_root: Array<u8> = new Array<u8>();
      public transactions_root: Array<u8> = new Array<u8>();
      public receipt_root: Array<u8> = new Array<u8>();
      public logs_bloom: Array<u8> = new Array<u8>();
      /**
       * Difficulty is the difficulty of the Proof of Work algorithm that was required to compute a solution.
       *
       *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
       *  consensus algorithm, this field will actually be constant and set to `0x00`.
       */
      public difficulty: BigInt = new BigInt();
      /**
       * TotalDifficulty is the sum of all previous blocks difficulty including this block difficulty.
       *
       *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
       *  consensus algorithm, this field will actually be constant and set to the terminal total difficulty
       *  that was required to transition to Proof of Stake algorithm, which varies per network. It is set to
       *  58 750 000 000 000 000 000 000 on Ethereum Mainnet and to 10 790 000 on Ethereum Testnet Goerli.
       */
      public total_difficulty: BigInt = new BigInt();
      public number: u64;
      public gas_limit: u64;
      public gas_used: u64;
      public timestamp: google.protobuf.Timestamp =
        new google.protobuf.Timestamp();
      /**
       * ExtraData is free-form bytes included in the block by the "miner". While on Yellow paper of
       *  Ethereum this value is maxed to 32 bytes, other consensus algorithm like Clique and some other
       *  forks are using bigger values to carry special consensus data.
       *
       *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
       *  consensus algorithm, this field is strictly enforced to be <= 32 bytes.
       */
      public extra_data: Array<u8> = new Array<u8>();
      /**
       * MixHash is used to prove, when combined with the `nonce` that sufficient amount of computation has been
       *  achieved and that the solution found is valid.
       */
      public mix_hash: Array<u8> = new Array<u8>();
      /**
       * Nonce is used to prove, when combined with the `mix_hash` that sufficient amount of computation has been
       *  achieved and that the solution found is valid.
       *
       *  If the Block containing this `BlockHeader` has been produced using the Proof of Stake
       *  consensus algorithm, this field will actually be constant and set to `0`.
       */
      public nonce: u64;
      /**
       * Hash is the hash of the block which is actually the computation:
       *
       *   Keccak256(rlp([
       *     parent_hash,
       *     uncle_hash,
       *     coinbase,
       *     state_root,
       *     transactions_root,
       *     receipt_root,
       *     logs_bloom,
       *     difficulty,
       *     number,
       *     gas_limit,
       *     gas_used,
       *     timestamp,
       *     extra_data,
       *     mix_hash,
       *     nonce,
       *     base_fee_per_gas (to be included only if London fork is active)
       *     withdrawals_root (to be included only if Shangai fork is active)
       *     blob_gas_used (to be included only if Cancun fork is active)
       *     excess_blob_gas (to be included only if Cancun fork is active)
       *     parent_beacon_root (to be included only if Cancun fork is active)
       *   ]))
       */
      public hash: Array<u8> = new Array<u8>();
      // Base fee per gas according to EIP-1559 (e.g. London Fork) rules, only set if London is present/active on the chain.
      public base_fee_per_gas: BigInt = new BigInt();
      /**
       * Withdrawals root hash according to EIP-4895 (e.g. Shangai Fork) rules, only set if Shangai is present/active on the chain.
       *
       *  Only available in DetailLevel: EXTENDED
       */
      public withdrawals_root: Array<u8> = new Array<u8>();
      // Only available in DetailLevel: EXTENDED
      public tx_dependency: Uint64NestedArray = new Uint64NestedArray();
      // BlobGasUsed was added by EIP-4844 and is ignored in legacy headers.
      public blob_gas_used: u64;
      // ExcessBlobGas was added by EIP-4844 and is ignored in legacy headers.
      public excess_blob_gas: u64;
      // ParentBeaconRoot was added by EIP-4788 and is ignored in legacy headers.
      public parent_beacon_root: Array<u8> = new Array<u8>();

      public ___blob_gas_used: string = "";
      public ___blob_gas_used_index: u8 = 0;

      public ___excess_blob_gas: string = "";
      public ___excess_blob_gas_index: u8 = 0;

      static readonly BLOB_GAS_USED_BLOB_GAS_USED_INDEX: u8 = 22;
      static readonly EXCESS_BLOB_GAS_EXCESS_BLOB_GAS_INDEX: u8 = 23;

      // Decodes BlockHeader from an ArrayBuffer
      static decode(buf: ArrayBuffer): BlockHeader {
        return BlockHeader.decodeDataView(new DataView(buf));
      }

      // Decodes BlockHeader from a DataView
      static decodeDataView(view: DataView): BlockHeader {
        const decoder = new __proto.Decoder(view);
        const obj = new BlockHeader();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.parent_hash = decoder.bytes();
              break;
            }
            case 2: {
              obj.uncle_hash = decoder.bytes();
              break;
            }
            case 3: {
              obj.coinbase = decoder.bytes();
              break;
            }
            case 4: {
              obj.state_root = decoder.bytes();
              break;
            }
            case 5: {
              obj.transactions_root = decoder.bytes();
              break;
            }
            case 6: {
              obj.receipt_root = decoder.bytes();
              break;
            }
            case 7: {
              obj.logs_bloom = decoder.bytes();
              break;
            }
            case 8: {
              const length = decoder.uint32();
              obj.difficulty = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 17: {
              const length = decoder.uint32();
              obj.total_difficulty = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 9: {
              obj.number = decoder.uint64();
              break;
            }
            case 10: {
              obj.gas_limit = decoder.uint64();
              break;
            }
            case 11: {
              obj.gas_used = decoder.uint64();
              break;
            }
            case 12: {
              const length = decoder.uint32();
              obj.timestamp = google.protobuf.Timestamp.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 13: {
              obj.extra_data = decoder.bytes();
              break;
            }
            case 14: {
              obj.mix_hash = decoder.bytes();
              break;
            }
            case 15: {
              obj.nonce = decoder.uint64();
              break;
            }
            case 16: {
              obj.hash = decoder.bytes();
              break;
            }
            case 18: {
              const length = decoder.uint32();
              obj.base_fee_per_gas = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 19: {
              obj.withdrawals_root = decoder.bytes();
              break;
            }
            case 20: {
              const length = decoder.uint32();
              obj.tx_dependency = Uint64NestedArray.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 22: {
              obj.blob_gas_used = decoder.uint64();
              obj.___blob_gas_used = "blob_gas_used";
              obj.___blob_gas_used_index = 22;
              break;
            }
            case 23: {
              obj.excess_blob_gas = decoder.uint64();
              obj.___excess_blob_gas = "excess_blob_gas";
              obj.___excess_blob_gas_index = 23;
              break;
            }
            case 24: {
              obj.parent_beacon_root = decoder.bytes();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode BlockHeader

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.parent_hash.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.parent_hash.length) +
              this.parent_hash.length
            : 0;
        size +=
          this.uncle_hash.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.uncle_hash.length) +
              this.uncle_hash.length
            : 0;
        size +=
          this.coinbase.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.coinbase.length) +
              this.coinbase.length
            : 0;
        size +=
          this.state_root.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.state_root.length) +
              this.state_root.length
            : 0;
        size +=
          this.transactions_root.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.transactions_root.length) +
              this.transactions_root.length
            : 0;
        size +=
          this.receipt_root.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.receipt_root.length) +
              this.receipt_root.length
            : 0;
        size +=
          this.logs_bloom.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.logs_bloom.length) +
              this.logs_bloom.length
            : 0;

        if (this.difficulty != null) {
          const f: BigInt = this.difficulty as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        if (this.total_difficulty != null) {
          const f: BigInt = this.total_difficulty as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);
        size +=
          this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);
        size +=
          this.gas_used == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_used);

        if (this.timestamp != null) {
          const f: google.protobuf.Timestamp = this
            .timestamp as google.protobuf.Timestamp;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.extra_data.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.extra_data.length) +
              this.extra_data.length
            : 0;
        size +=
          this.mix_hash.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.mix_hash.length) +
              this.mix_hash.length
            : 0;
        size += this.nonce == 0 ? 0 : 1 + __proto.Sizer.uint64(this.nonce);
        size +=
          this.hash.length > 0
            ? 2 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
            : 0;

        if (this.base_fee_per_gas != null) {
          const f: BigInt = this.base_fee_per_gas as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.withdrawals_root.length > 0
            ? 2 +
              __proto.Sizer.varint64(this.withdrawals_root.length) +
              this.withdrawals_root.length
            : 0;

        if (this.tx_dependency != null) {
          const f: Uint64NestedArray = this.tx_dependency as Uint64NestedArray;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.blob_gas_used == 0
            ? 0
            : 2 + __proto.Sizer.uint64(this.blob_gas_used);
        size +=
          this.excess_blob_gas == 0
            ? 0
            : 2 + __proto.Sizer.uint64(this.excess_blob_gas);
        size +=
          this.parent_beacon_root.length > 0
            ? 2 +
              __proto.Sizer.varint64(this.parent_beacon_root.length) +
              this.parent_beacon_root.length
            : 0;

        return size;
      }

      // Encodes BlockHeader to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes BlockHeader to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.parent_hash.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.parent_hash.length);
          encoder.bytes(this.parent_hash);
        }
        if (this.uncle_hash.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.uncle_hash.length);
          encoder.bytes(this.uncle_hash);
        }
        if (this.coinbase.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.coinbase.length);
          encoder.bytes(this.coinbase);
        }
        if (this.state_root.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.state_root.length);
          encoder.bytes(this.state_root);
        }
        if (this.transactions_root.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.transactions_root.length);
          encoder.bytes(this.transactions_root);
        }
        if (this.receipt_root.length > 0) {
          encoder.uint32(0x32);
          encoder.uint32(this.receipt_root.length);
          encoder.bytes(this.receipt_root);
        }
        if (this.logs_bloom.length > 0) {
          encoder.uint32(0x3a);
          encoder.uint32(this.logs_bloom.length);
          encoder.bytes(this.logs_bloom);
        }

        if (this.difficulty != null) {
          const f = this.difficulty as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x42);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.total_difficulty != null) {
          const f = this.total_difficulty as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x8a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.number != 0) {
          encoder.uint32(0x48);
          encoder.uint64(this.number);
        }
        if (this.gas_limit != 0) {
          encoder.uint32(0x50);
          encoder.uint64(this.gas_limit);
        }
        if (this.gas_used != 0) {
          encoder.uint32(0x58);
          encoder.uint64(this.gas_used);
        }

        if (this.timestamp != null) {
          const f = this.timestamp as google.protobuf.Timestamp;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x62);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.extra_data.length > 0) {
          encoder.uint32(0x6a);
          encoder.uint32(this.extra_data.length);
          encoder.bytes(this.extra_data);
        }
        if (this.mix_hash.length > 0) {
          encoder.uint32(0x72);
          encoder.uint32(this.mix_hash.length);
          encoder.bytes(this.mix_hash);
        }
        if (this.nonce != 0) {
          encoder.uint32(0x78);
          encoder.uint64(this.nonce);
        }
        if (this.hash.length > 0) {
          encoder.uint32(0x82);
          encoder.uint32(this.hash.length);
          encoder.bytes(this.hash);
        }

        if (this.base_fee_per_gas != null) {
          const f = this.base_fee_per_gas as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x92);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.withdrawals_root.length > 0) {
          encoder.uint32(0x9a);
          encoder.uint32(this.withdrawals_root.length);
          encoder.bytes(this.withdrawals_root);
        }

        if (this.tx_dependency != null) {
          const f = this.tx_dependency as Uint64NestedArray;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0xa2);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.blob_gas_used != 0) {
          encoder.uint32(0xb0);
          encoder.uint64(this.blob_gas_used);
        }
        if (this.excess_blob_gas != 0) {
          encoder.uint32(0xb8);
          encoder.uint64(this.excess_blob_gas);
        }
        if (this.parent_beacon_root.length > 0) {
          encoder.uint32(0xc2);
          encoder.uint32(this.parent_beacon_root.length);
          encoder.bytes(this.parent_beacon_root);
        }

        return buf;
      } // encode BlockHeader
    } // BlockHeader

    export class Uint64NestedArray {
      public val: Array<Uint64Array> = new Array<Uint64Array>();

      // Decodes Uint64NestedArray from an ArrayBuffer
      static decode(buf: ArrayBuffer): Uint64NestedArray {
        return Uint64NestedArray.decodeDataView(new DataView(buf));
      }

      // Decodes Uint64NestedArray from a DataView
      static decodeDataView(view: DataView): Uint64NestedArray {
        const decoder = new __proto.Decoder(view);
        const obj = new Uint64NestedArray();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              const length = decoder.uint32();
              obj.val.push(
                Uint64Array.decodeDataView(
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
      } // decode Uint64NestedArray

      public size(): u32 {
        let size: u32 = 0;

        for (let n: i32 = 0; n < this.val.length; n++) {
          const messageSize = this.val[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        return size;
      }

      // Encodes Uint64NestedArray to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Uint64NestedArray to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        for (let n: i32 = 0; n < this.val.length; n++) {
          const messageSize = this.val[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xa);
            encoder.uint32(messageSize);
            this.val[n].encodeU8Array(encoder);
          }
        }

        return buf;
      } // encode Uint64NestedArray
    } // Uint64NestedArray

    export class Uint64Array {
      public val: Array<u64> = new Array<u64>();

      // Decodes Uint64Array from an ArrayBuffer
      static decode(buf: ArrayBuffer): Uint64Array {
        return Uint64Array.decodeDataView(new DataView(buf));
      }

      // Decodes Uint64Array from a DataView
      static decodeDataView(view: DataView): Uint64Array {
        const decoder = new __proto.Decoder(view);
        const obj = new Uint64Array();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              const endPos = decoder.pos + decoder.uint32();
              while (decoder.pos <= endPos) {
                obj.val.push(decoder.uint64());
              }

              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Uint64Array

      public size(): u32 {
        let size: u32 = 0;

        if (this.val.length > 0) {
          const packedSize = __size_uint64_repeated_packed(this.val);
          if (packedSize > 0) {
            size += 1 + __proto.Sizer.varint64(packedSize) + packedSize;
          }
        }

        return size;
      }

      // Encodes Uint64Array to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Uint64Array to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.val.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(__size_uint64_repeated_packed(this.val));

          for (let n: i32 = 0; n < this.val.length; n++) {
            encoder.uint64(this.val[n]);
          }
        }

        return buf;
      } // encode Uint64Array
    } // Uint64Array

    export class BigInt {
      public bytes: Array<u8> = new Array<u8>();

      // Decodes BigInt from an ArrayBuffer
      static decode(buf: ArrayBuffer): BigInt {
        return BigInt.decodeDataView(new DataView(buf));
      }

      // Decodes BigInt from a DataView
      static decodeDataView(view: DataView): BigInt {
        const decoder = new __proto.Decoder(view);
        const obj = new BigInt();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.bytes = decoder.bytes();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode BigInt

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.bytes.length > 0
            ? 1 + __proto.Sizer.varint64(this.bytes.length) + this.bytes.length
            : 0;

        return size;
      }

      // Encodes BigInt to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes BigInt to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.bytes.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.bytes.length);
          encoder.bytes(this.bytes);
        }

        return buf;
      } // encode BigInt
    } // BigInt

    /**
     * TransactionTrace is full trace of execution of the transaction when the
     *  it actually executed on chain.
     *
     *  It contains all the transaction details like `from`, `to`, `gas`, etc.
     *  as well as all the internal calls that were made during the transaction.
     *
     *  The `calls` vector contains Call objects which have balance changes, events
     *  storage changes, etc.
     *
     *  If ordering is important between elements, almost each message like `Log`,
     *  `Call`, `StorageChange`, etc. have an ordinal field that is represents "execution"
     *  order of the said element against all other elements in this block.
     *
     *  Due to how the call tree works doing "naively", looping through all calls then
     *  through a Call's element like `logs` while not yielding the elements in the order
     *  they were executed on chain. A log in call could have been done before or after
     *  another in another call depending on the actual call tree.
     *
     *  The `calls` are ordered by creation order and the call tree can be re-computing
     *  using fields found in `Call` object (parent/child relationship).
     *
     *  Another important thing to note is that even if a transaction succeed, some calls
     *  within it could have been reverted internally, if this is important to you, you must
     *  check the field `state_reverted` on the `Call` to determine if it was fully committed
     *  to the chain or not.
     */
    export class TransactionTrace {
      // consensus
      public to: Array<u8> = new Array<u8>();
      public nonce: u64;
      /**
       * GasPrice represents the effective price that has been paid for each gas unit of this transaction. Over time, the
       *  Ethereum rules changes regarding GasPrice field here. Before London fork, the GasPrice was always set to the
       *  fixed gas price. After London fork, this value has different meaning depending on the transaction type (see `Type` field).
       *
       *  In cases where `TransactionTrace.Type == TRX_TYPE_LEGACY || TRX_TYPE_ACCESS_LIST`, then GasPrice has the same meaning
       *  as before the London fork.
       *
       *  In cases where `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE`, then GasPrice is the effective gas price paid
       *  for the transaction which is equals to `BlockHeader.BaseFeePerGas + TransactionTrace.`
       */
      public gas_price: BigInt = new BigInt();
      /**
       * GasLimit is the maximum of gas unit the sender of the transaction is willing to consume when perform the EVM
       *  execution of the whole transaction
       */
      public gas_limit: u64;
      // Value is the amount of Ether transferred as part of this transaction.
      public value: BigInt = new BigInt();
      // Input data the transaction will receive for execution of EVM.
      public input: Array<u8> = new Array<u8>();
      // V is the recovery ID value for the signature Y point.
      public v: Array<u8> = new Array<u8>();
      // R is the signature's X point on the elliptic curve (32 bytes).
      public r: Array<u8> = new Array<u8>();
      // S is the signature's Y point on the elliptic curve (32 bytes).
      public s: Array<u8> = new Array<u8>();
      // GasUsed is the total amount of gas unit used for the whole execution of the transaction.
      public gas_used: u64;
      /**
       * Type represents the Ethereum transaction type, available only since EIP-2718 & EIP-2930 activation which happened on Berlin fork.
       *  The value is always set even for transaction before Berlin fork because those before the fork are still legacy transactions.
       */
      public type: u32;
      /**
       * AcccessList represents the storage access this transaction has agreed to do in which case those storage
       *  access cost less gas unit per access.
       *
       *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_ACCESS_LIST || TRX_TYPE_DYNAMIC_FEE` which
       *  is possible only if Berlin (TRX_TYPE_ACCESS_LIST) nor London (TRX_TYPE_DYNAMIC_FEE) fork are active on the chain.
       */
      public access_list: Array<AccessTuple> = new Array<AccessTuple>();
      /**
       * MaxFeePerGas is the maximum fee per gas the user is willing to pay for the transaction gas used.
       *
       *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE` which is possible only
       *  if Londong fork is active on the chain.
       *
       *  Only available in DetailLevel: EXTENDED
       */
      public max_fee_per_gas: BigInt = new BigInt();
      /**
       * MaxPriorityFeePerGas is priority fee per gas the user to pay in extra to the miner on top of the block's
       *  base fee.
       *
       *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_DYNAMIC_FEE` which is possible only
       *  if London fork is active on the chain.
       *
       *  Only available in DetailLevel: EXTENDED
       */
      public max_priority_fee_per_gas: BigInt = new BigInt();
      // meta
      public index: u32;
      public hash: Array<u8> = new Array<u8>();
      public from: Array<u8> = new Array<u8>();
      // Only available in DetailLevel: EXTENDED
      public return_data: Array<u8> = new Array<u8>();
      // Only available in DetailLevel: EXTENDED
      public public_key: Array<u8> = new Array<u8>();
      public begin_ordinal: u64;
      public end_ordinal: u64;
      /**
       * TransactionTraceStatus is the status of the transaction execution and will let you know if the transaction
       *  was successful or not.
       *
       *  A successful transaction has been recorded to the blockchain's state for calls in it that were successful.
       *  This means it's possible only a subset of the calls were properly recorded, refer to [calls[].state_reverted] field
       *  to determine which calls were reverted.
       *
       *  A quirks of the Ethereum protocol is that a transaction `FAILED` or `REVERTED` still affects the blockchain's
       *  state for **some** of the state changes. Indeed, in those cases, the transactions fees are still paid to the miner
       *  which means there is a balance change for the transaction's emitter (e.g. `from`) to pay the gas fees, an optional
       *  balance change for gas refunded to the transaction's emitter (e.g. `from`) and a balance change for the miner who
       *  received the transaction fees. There is also a nonce change for the transaction's emitter (e.g. `from`).
       *
       *  This means that to properly record the state changes for a transaction, you need to conditionally procees the
       *  transaction's status.
       *
       *  For a `SUCCEEDED` transaction, you iterate over the `calls` array and record the state changes for each call for
       *  which `state_reverted == false` (if a transaction succeeded, the call at #0 will always `state_reverted == false`
       *  because it aligns with the transaction).
       *
       *  For a `FAILED` or `REVERTED` transaction, you iterate over the root call (e.g. at #0, will always exist) for
       *  balance changes you process those where `reason` is either `REASON_GAS_BUY`, `REASON_GAS_REFUND` or
       *  `REASON_REWARD_TRANSACTION_FEE` and for nonce change, still on the root call, you pick the nonce change which the
       *  smallest ordinal (if more than one).
       */
      public status: u32;
      public receipt: TransactionReceipt = new TransactionReceipt();
      // Only available in DetailLevel: EXTENDED
      public calls: Array<Call> = new Array<Call>();
      /**
       * BlobGas is the amount of gas the transaction is going to pay for the blobs, this is a computed value
       *  equivalent to `self.blob_gas_fee_cap * len(self.blob_hashes)` and provided in the model for convenience.
       *
       *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
       *
       *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
       *  if Cancun fork is active on the chain.
       */
      public blob_gas: u64;
      /**
       * BlobGasFeeCap is the maximum fee per data gas the user is willing to pay for the data gas used.
       *
       *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
       *
       *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
       *  if Cancun fork is active on the chain.
       */
      public blob_gas_fee_cap: BigInt | null;
      /**
       * BlobHashes field represents a list of hash outputs from 'kzg_to_versioned_hash' which
       *  essentially is a version byte + the sha256 hash of the blob commitment (e.g.
       *  `BLOB_COMMITMENT_VERSION_KZG + sha256(commitment)[1:]`.
       *
       *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
       *
       *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
       *  if Cancun fork is active on the chain.
       */
      public blob_hashes: Array<Array<u8>> = new Array<Array<u8>>();

      public ___blob_gas: string = "";
      public ___blob_gas_index: u8 = 0;

      public ___blob_gas_fee_cap: string = "";
      public ___blob_gas_fee_cap_index: u8 = 0;

      static readonly BLOB_GAS_BLOB_GAS_INDEX: u8 = 33;
      static readonly BLOB_GAS_FEE_CAP_BLOB_GAS_FEE_CAP_INDEX: u8 = 34;

      // Decodes TransactionTrace from an ArrayBuffer
      static decode(buf: ArrayBuffer): TransactionTrace {
        return TransactionTrace.decodeDataView(new DataView(buf));
      }

      // Decodes TransactionTrace from a DataView
      static decodeDataView(view: DataView): TransactionTrace {
        const decoder = new __proto.Decoder(view);
        const obj = new TransactionTrace();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.to = decoder.bytes();
              break;
            }
            case 2: {
              obj.nonce = decoder.uint64();
              break;
            }
            case 3: {
              const length = decoder.uint32();
              obj.gas_price = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 4: {
              obj.gas_limit = decoder.uint64();
              break;
            }
            case 5: {
              const length = decoder.uint32();
              obj.value = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 6: {
              obj.input = decoder.bytes();
              break;
            }
            case 7: {
              obj.v = decoder.bytes();
              break;
            }
            case 8: {
              obj.r = decoder.bytes();
              break;
            }
            case 9: {
              obj.s = decoder.bytes();
              break;
            }
            case 10: {
              obj.gas_used = decoder.uint64();
              break;
            }
            case 12: {
              obj.type = decoder.uint32();
              break;
            }
            case 14: {
              const length = decoder.uint32();
              obj.access_list.push(
                AccessTuple.decodeDataView(
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
            case 11: {
              const length = decoder.uint32();
              obj.max_fee_per_gas = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 13: {
              const length = decoder.uint32();
              obj.max_priority_fee_per_gas = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 20: {
              obj.index = decoder.uint32();
              break;
            }
            case 21: {
              obj.hash = decoder.bytes();
              break;
            }
            case 22: {
              obj.from = decoder.bytes();
              break;
            }
            case 23: {
              obj.return_data = decoder.bytes();
              break;
            }
            case 24: {
              obj.public_key = decoder.bytes();
              break;
            }
            case 25: {
              obj.begin_ordinal = decoder.uint64();
              break;
            }
            case 26: {
              obj.end_ordinal = decoder.uint64();
              break;
            }
            case 30: {
              obj.status = decoder.uint32();
              break;
            }
            case 31: {
              const length = decoder.uint32();
              obj.receipt = TransactionReceipt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 32: {
              const length = decoder.uint32();
              obj.calls.push(
                Call.decodeDataView(
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
            case 33: {
              obj.blob_gas = decoder.uint64();
              obj.___blob_gas = "blob_gas";
              obj.___blob_gas_index = 33;
              break;
            }
            case 34: {
              const length = decoder.uint32();
              obj.blob_gas_fee_cap = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              obj.___blob_gas_fee_cap = "blob_gas_fee_cap";
              obj.___blob_gas_fee_cap_index = 34;
              break;
            }
            case 35: {
              obj.blob_hashes.push(decoder.bytes());
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode TransactionTrace

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.to.length > 0
            ? 1 + __proto.Sizer.varint64(this.to.length) + this.to.length
            : 0;
        size += this.nonce == 0 ? 0 : 1 + __proto.Sizer.uint64(this.nonce);

        if (this.gas_price != null) {
          const f: BigInt = this.gas_price as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);

        if (this.value != null) {
          const f: BigInt = this.value as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.input.length > 0
            ? 1 + __proto.Sizer.varint64(this.input.length) + this.input.length
            : 0;
        size +=
          this.v.length > 0
            ? 1 + __proto.Sizer.varint64(this.v.length) + this.v.length
            : 0;
        size +=
          this.r.length > 0
            ? 1 + __proto.Sizer.varint64(this.r.length) + this.r.length
            : 0;
        size +=
          this.s.length > 0
            ? 1 + __proto.Sizer.varint64(this.s.length) + this.s.length
            : 0;
        size +=
          this.gas_used == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_used);
        size += this.type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.type);

        for (let n: i32 = 0; n < this.access_list.length; n++) {
          const messageSize = this.access_list[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        if (this.max_fee_per_gas != null) {
          const f: BigInt = this.max_fee_per_gas as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        if (this.max_priority_fee_per_gas != null) {
          const f: BigInt = this.max_priority_fee_per_gas as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size += this.index == 0 ? 0 : 2 + __proto.Sizer.uint32(this.index);
        size +=
          this.hash.length > 0
            ? 2 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
            : 0;
        size +=
          this.from.length > 0
            ? 2 + __proto.Sizer.varint64(this.from.length) + this.from.length
            : 0;
        size +=
          this.return_data.length > 0
            ? 2 +
              __proto.Sizer.varint64(this.return_data.length) +
              this.return_data.length
            : 0;
        size +=
          this.public_key.length > 0
            ? 2 +
              __proto.Sizer.varint64(this.public_key.length) +
              this.public_key.length
            : 0;
        size +=
          this.begin_ordinal == 0
            ? 0
            : 2 + __proto.Sizer.uint64(this.begin_ordinal);
        size +=
          this.end_ordinal == 0
            ? 0
            : 2 + __proto.Sizer.uint64(this.end_ordinal);
        size += this.status == 0 ? 0 : 2 + __proto.Sizer.uint32(this.status);

        if (this.receipt != null) {
          const f: TransactionReceipt = this.receipt as TransactionReceipt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.calls.length; n++) {
          const messageSize = this.calls[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.blob_gas == 0 ? 0 : 2 + __proto.Sizer.uint64(this.blob_gas);

        if (this.blob_gas_fee_cap != null) {
          const f: BigInt = this.blob_gas_fee_cap as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size += __size_bytes_repeated(this.blob_hashes);

        return size;
      }

      // Encodes TransactionTrace to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes TransactionTrace to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.to.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.to.length);
          encoder.bytes(this.to);
        }
        if (this.nonce != 0) {
          encoder.uint32(0x10);
          encoder.uint64(this.nonce);
        }

        if (this.gas_price != null) {
          const f = this.gas_price as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.gas_limit != 0) {
          encoder.uint32(0x20);
          encoder.uint64(this.gas_limit);
        }

        if (this.value != null) {
          const f = this.value as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.input.length > 0) {
          encoder.uint32(0x32);
          encoder.uint32(this.input.length);
          encoder.bytes(this.input);
        }
        if (this.v.length > 0) {
          encoder.uint32(0x3a);
          encoder.uint32(this.v.length);
          encoder.bytes(this.v);
        }
        if (this.r.length > 0) {
          encoder.uint32(0x42);
          encoder.uint32(this.r.length);
          encoder.bytes(this.r);
        }
        if (this.s.length > 0) {
          encoder.uint32(0x4a);
          encoder.uint32(this.s.length);
          encoder.bytes(this.s);
        }
        if (this.gas_used != 0) {
          encoder.uint32(0x50);
          encoder.uint64(this.gas_used);
        }
        if (this.type != 0) {
          encoder.uint32(0x60);
          encoder.uint32(this.type);
        }

        for (let n: i32 = 0; n < this.access_list.length; n++) {
          const messageSize = this.access_list[n].size();

          if (messageSize > 0) {
            encoder.uint32(0x72);
            encoder.uint32(messageSize);
            this.access_list[n].encodeU8Array(encoder);
          }
        }

        if (this.max_fee_per_gas != null) {
          const f = this.max_fee_per_gas as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x5a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.max_priority_fee_per_gas != null) {
          const f = this.max_priority_fee_per_gas as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x6a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.index != 0) {
          encoder.uint32(0xa0);
          encoder.uint32(this.index);
        }
        if (this.hash.length > 0) {
          encoder.uint32(0xaa);
          encoder.uint32(this.hash.length);
          encoder.bytes(this.hash);
        }
        if (this.from.length > 0) {
          encoder.uint32(0xb2);
          encoder.uint32(this.from.length);
          encoder.bytes(this.from);
        }
        if (this.return_data.length > 0) {
          encoder.uint32(0xba);
          encoder.uint32(this.return_data.length);
          encoder.bytes(this.return_data);
        }
        if (this.public_key.length > 0) {
          encoder.uint32(0xc2);
          encoder.uint32(this.public_key.length);
          encoder.bytes(this.public_key);
        }
        if (this.begin_ordinal != 0) {
          encoder.uint32(0xc8);
          encoder.uint64(this.begin_ordinal);
        }
        if (this.end_ordinal != 0) {
          encoder.uint32(0xd0);
          encoder.uint64(this.end_ordinal);
        }
        if (this.status != 0) {
          encoder.uint32(0xf0);
          encoder.uint32(this.status);
        }

        if (this.receipt != null) {
          const f = this.receipt as TransactionReceipt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0xfa);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.calls.length; n++) {
          const messageSize = this.calls[n].size();

          if (messageSize > 0) {
            encoder.uint32(0x102);
            encoder.uint32(messageSize);
            this.calls[n].encodeU8Array(encoder);
          }
        }

        if (this.blob_gas != 0) {
          encoder.uint32(0x108);
          encoder.uint64(this.blob_gas);
        }

        if (this.blob_gas_fee_cap != null) {
          const f = this.blob_gas_fee_cap as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x112);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.blob_hashes.length > 0) {
          for (let n: i32 = 0; n < this.blob_hashes.length; n++) {
            encoder.uint32(0x11a);
            encoder.uint32(this.blob_hashes[n].length);
            encoder.bytes(this.blob_hashes[n]);
          }
        }

        return buf;
      } // encode TransactionTrace
    } // TransactionTrace

    export enum TransactionTrace_Type {
      // All transactions that ever existed prior Berlin fork before EIP-2718 was implemented.
      TRX_TYPE_LEGACY = 0,
      /**
       * Transaction that specicy an access list of contract/storage_keys that is going to be used
       *  in this transaction.
       *
       *  Added in Berlin fork (EIP-2930).
       */
      TRX_TYPE_ACCESS_LIST = 1,
      /**
       * Transaction that specifis an access list just like TRX_TYPE_ACCESS_LIST but in addition defines the
       *  max base gas gee and max priority gas fee to pay for this transaction. Transaction's of those type are
       *  executed against EIP-1559 rules which dictates a dynamic gas cost based on the congestion of the network.
       */
      TRX_TYPE_DYNAMIC_FEE = 2,
      /**
       * Transaction which contain a large amount of data that cannot be accessed by EVM execution, but whose commitment
       *  can be accessed. The format is intended to be fully compatible with the format that will be used in full sharding.
       *
       *  Transaction that defines specifis an access list just like TRX_TYPE_ACCESS_LIST and enables dynamic fee just like
       *  TRX_TYPE_DYNAMIC_FEE but in addition defines the fields 'max_fee_per_data_gas' of type 'uint256' and the fields
       *  'blob_versioned_hashes' field represents a list of hash outputs from 'kzg_to_versioned_hash'.
       *
       *  Activated in Dencun
       */
      TRX_TYPE_BLOB = 3,
      // Arbitrum-specific transactions
      TRX_TYPE_ARBITRUM_DEPOSIT = 100,
      TRX_TYPE_ARBITRUM_UNSIGNED = 101,
      TRX_TYPE_ARBITRUM_CONTRACT = 102,
      TRX_TYPE_ARBITRUM_RETRY = 104,
      TRX_TYPE_ARBITRUM_SUBMIT_RETRYABLE = 105,
      TRX_TYPE_ARBITRUM_INTERNAL = 106,
      TRX_TYPE_ARBITRUM_LEGACY = 120,
    } // TransactionTrace_Type
    /**
     * AccessTuple represents a list of storage keys for a given contract's address and is used
     *  for AccessList construction.
     */
    export class AccessTuple {
      public address: Array<u8> = new Array<u8>();
      public storage_keys: Array<Array<u8>> = new Array<Array<u8>>();

      // Decodes AccessTuple from an ArrayBuffer
      static decode(buf: ArrayBuffer): AccessTuple {
        return AccessTuple.decodeDataView(new DataView(buf));
      }

      // Decodes AccessTuple from a DataView
      static decodeDataView(view: DataView): AccessTuple {
        const decoder = new __proto.Decoder(view);
        const obj = new AccessTuple();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.address = decoder.bytes();
              break;
            }
            case 2: {
              obj.storage_keys.push(decoder.bytes());
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode AccessTuple

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;

        size += __size_bytes_repeated(this.storage_keys);

        return size;
      }

      // Encodes AccessTuple to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes AccessTuple to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.address.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.address.length);
          encoder.bytes(this.address);
        }

        if (this.storage_keys.length > 0) {
          for (let n: i32 = 0; n < this.storage_keys.length; n++) {
            encoder.uint32(0x12);
            encoder.uint32(this.storage_keys[n].length);
            encoder.bytes(this.storage_keys[n]);
          }
        }

        return buf;
      } // encode AccessTuple
    } // AccessTuple

    export class TransactionReceipt {
      /**
       * State root is an intermediate state_root hash, computed in-between transactions to make
       *  **sure** you could build a proof and point to state in the middle of a block. Geth client
       *  uses `PostState + root + PostStateOrStatus`` while Parity used `status_code, root...`` this piles
       *  hardforks, see (read the EIPs first):
       *  - https://github.com/ethereum/EIPs/blob/master/EIPS/eip-658.md
       *
       *  Moreover, the notion of `Outcome`` in parity, which segregates the two concepts, which are
       *  stored in the same field `status_code`` can be computed based on such a hack of the `state_root`
       *  field, following `EIP-658`.
       *
       *  Before Byzantinium hard fork, this field is always empty.
       */
      public state_root: Array<u8> = new Array<u8>();
      public cumulative_gas_used: u64;
      public logs_bloom: Array<u8> = new Array<u8>();
      public logs: Array<Log> = new Array<Log>();
      /**
       * BlobGasUsed is the amount of blob gas that has been used within this transaction. At time
       *  of writing, this is equal to `self.blob_gas_fee_cap * len(self.blob_hashes)`.
       *
       *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
       *
       *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
       *  if Cancun fork is active on the chain.
       */
      public blob_gas_used: u64;
      /**
       * BlobGasPrice is the amount to pay per blob item in the transaction.
       *
       *  This is specified by https://eips.ethereum.org/EIPS/eip-4844
       *
       *  This will is populated only if `TransactionTrace.Type == TRX_TYPE_BLOB` which is possible only
       *  if Cancun fork is active on the chain.
       */
      public blob_gas_price: BigInt | null;

      public ___blob_gas_used: string = "";
      public ___blob_gas_used_index: u8 = 0;

      public ___blob_gas_price: string = "";
      public ___blob_gas_price_index: u8 = 0;

      static readonly BLOB_GAS_USED_BLOB_GAS_USED_INDEX: u8 = 5;
      static readonly BLOB_GAS_PRICE_BLOB_GAS_PRICE_INDEX: u8 = 6;

      // Decodes TransactionReceipt from an ArrayBuffer
      static decode(buf: ArrayBuffer): TransactionReceipt {
        return TransactionReceipt.decodeDataView(new DataView(buf));
      }

      // Decodes TransactionReceipt from a DataView
      static decodeDataView(view: DataView): TransactionReceipt {
        const decoder = new __proto.Decoder(view);
        const obj = new TransactionReceipt();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.state_root = decoder.bytes();
              break;
            }
            case 2: {
              obj.cumulative_gas_used = decoder.uint64();
              break;
            }
            case 3: {
              obj.logs_bloom = decoder.bytes();
              break;
            }
            case 4: {
              const length = decoder.uint32();
              obj.logs.push(
                Log.decodeDataView(
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
            case 5: {
              obj.blob_gas_used = decoder.uint64();
              obj.___blob_gas_used = "blob_gas_used";
              obj.___blob_gas_used_index = 5;
              break;
            }
            case 6: {
              const length = decoder.uint32();
              obj.blob_gas_price = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              obj.___blob_gas_price = "blob_gas_price";
              obj.___blob_gas_price_index = 6;
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode TransactionReceipt

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.state_root.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.state_root.length) +
              this.state_root.length
            : 0;
        size +=
          this.cumulative_gas_used == 0
            ? 0
            : 1 + __proto.Sizer.uint64(this.cumulative_gas_used);
        size +=
          this.logs_bloom.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.logs_bloom.length) +
              this.logs_bloom.length
            : 0;

        for (let n: i32 = 0; n < this.logs.length; n++) {
          const messageSize = this.logs[n].size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.blob_gas_used == 0
            ? 0
            : 1 + __proto.Sizer.uint64(this.blob_gas_used);

        if (this.blob_gas_price != null) {
          const f: BigInt = this.blob_gas_price as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        return size;
      }

      // Encodes TransactionReceipt to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes TransactionReceipt to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.state_root.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.state_root.length);
          encoder.bytes(this.state_root);
        }
        if (this.cumulative_gas_used != 0) {
          encoder.uint32(0x10);
          encoder.uint64(this.cumulative_gas_used);
        }
        if (this.logs_bloom.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.logs_bloom.length);
          encoder.bytes(this.logs_bloom);
        }

        for (let n: i32 = 0; n < this.logs.length; n++) {
          const messageSize = this.logs[n].size();

          if (messageSize > 0) {
            encoder.uint32(0x22);
            encoder.uint32(messageSize);
            this.logs[n].encodeU8Array(encoder);
          }
        }

        if (this.blob_gas_used != 0) {
          encoder.uint32(0x28);
          encoder.uint64(this.blob_gas_used);
        }

        if (this.blob_gas_price != null) {
          const f = this.blob_gas_price as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x32);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        return buf;
      } // encode TransactionReceipt
    } // TransactionReceipt

    export class Log {
      public address: Array<u8> = new Array<u8>();
      public topics: Array<Array<u8>> = new Array<Array<u8>>();
      public data: Array<u8> = new Array<u8>();
      /**
       * Index is the index of the log relative to the transaction. This index
       *  is always populated regardless of the state revertion of the the call
       *  that emitted this log.
       *
       *  Only available in DetailLevel: EXTENDED
       */
      public index: u32;
      /**
       * BlockIndex represents the index of the log relative to the Block.
       *
       *  An **important** notice is that this field will be 0 when the call
       *  that emitted the log has been reverted by the chain.
       *
       *  Currently, there is two locations where a Log can be obtained:
       *  - block.transaction_traces[].receipt.logs[]
       *  - block.transaction_traces[].calls[].logs[]
       *
       *  In the `receipt` case, the logs will be populated only when the call
       *  that emitted them has not been reverted by the chain and when in this
       *  position, the `blockIndex` is always populated correctly.
       *
       *  In the case of `calls` case, for `call` where `stateReverted == true`,
       *  the `blockIndex` value will always be 0.
       */
      public blockIndex: u32;
      public ordinal: u64;

      // Decodes Log from an ArrayBuffer
      static decode(buf: ArrayBuffer): Log {
        return Log.decodeDataView(new DataView(buf));
      }

      // Decodes Log from a DataView
      static decodeDataView(view: DataView): Log {
        const decoder = new __proto.Decoder(view);
        const obj = new Log();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.address = decoder.bytes();
              break;
            }
            case 2: {
              obj.topics.push(decoder.bytes());
              break;
            }
            case 3: {
              obj.data = decoder.bytes();
              break;
            }
            case 4: {
              obj.index = decoder.uint32();
              break;
            }
            case 6: {
              obj.blockIndex = decoder.uint32();
              break;
            }
            case 7: {
              obj.ordinal = decoder.uint64();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode Log

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;

        size += __size_bytes_repeated(this.topics);

        size +=
          this.data.length > 0
            ? 1 + __proto.Sizer.varint64(this.data.length) + this.data.length
            : 0;
        size += this.index == 0 ? 0 : 1 + __proto.Sizer.uint32(this.index);
        size +=
          this.blockIndex == 0 ? 0 : 1 + __proto.Sizer.uint32(this.blockIndex);
        size += this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

        return size;
      }

      // Encodes Log to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Log to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.address.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.address.length);
          encoder.bytes(this.address);
        }

        if (this.topics.length > 0) {
          for (let n: i32 = 0; n < this.topics.length; n++) {
            encoder.uint32(0x12);
            encoder.uint32(this.topics[n].length);
            encoder.bytes(this.topics[n]);
          }
        }

        if (this.data.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.data.length);
          encoder.bytes(this.data);
        }
        if (this.index != 0) {
          encoder.uint32(0x20);
          encoder.uint32(this.index);
        }
        if (this.blockIndex != 0) {
          encoder.uint32(0x30);
          encoder.uint32(this.blockIndex);
        }
        if (this.ordinal != 0) {
          encoder.uint32(0x38);
          encoder.uint64(this.ordinal);
        }

        return buf;
      } // encode Log
    } // Log

    export class Call {
      public index: u32;
      public parent_index: u32;
      public depth: u32;
      public call_type: u32;
      public caller: Array<u8> = new Array<u8>();
      public address: Array<u8> = new Array<u8>();
      public value: BigInt = new BigInt();
      public gas_limit: u64;
      public gas_consumed: u64;
      public return_data: Array<u8> = new Array<u8>();
      public input: Array<u8> = new Array<u8>();
      public executed_code: bool;
      public suicide: bool;
      // hex representation of the hash -> preimage
      public keccak_preimages: Map<string, string> = new Map<string, string>();
      public storage_changes: Array<StorageChange> = new Array<StorageChange>();
      public balance_changes: Array<BalanceChange> = new Array<BalanceChange>();
      public nonce_changes: Array<NonceChange> = new Array<NonceChange>();
      public logs: Array<Log> = new Array<Log>();
      public code_changes: Array<CodeChange> = new Array<CodeChange>();
      public gas_changes: Array<GasChange> = new Array<GasChange>();
      /**
       * In Ethereum, a call can be either:
       *  - Successfull, execution passes without any problem encountered
       *  - Failed, execution failed, and remaining gas should be consumed
       *  - Reverted, execution failed, but only gas consumed so far is billed, remaining gas is refunded
       *
       *  When a call is either `failed` or `reverted`, the `status_failed` field
       *  below is set to `true`. If the status is `reverted`, then both `status_failed`
       *  and `status_reverted` are going to be set to `true`.
       */
      public status_failed: bool;
      public status_reverted: bool;
      /**
       * Populated when a call either failed or reverted, so when `status_failed == true`,
       *  see above for details about those flags.
       */
      public failure_reason: string = "";
      /**
       * This field represents wheter or not the state changes performed
       *  by this call were correctly recorded by the blockchain.
       *
       *  On Ethereum, a transaction can record state changes even if some
       *  of its inner nested calls failed. This is problematic however since
       *  a call will invalidate all its state changes as well as all state
       *  changes performed by its child call. This means that even if a call
       *  has a status of `SUCCESS`, the chain might have reverted all the state
       *  changes it performed.
       *
       *  ```text
       *    Trx 1
       *     Call #1 <Failed>
       *       Call #2 <Execution Success>
       *       Call #3 <Execution Success>
       *       |--- Failure here
       *     Call #4
       *  ```
       *
       *  In the transaction above, while Call #2 and Call #3 would have the
       *  status `EXECUTED`.
       *
       *  If you check all calls and check only `state_reverted` flag, you might be missing
       *  some balance changes and nonce changes. This is because when a full transaction fails
       *  in ethereum (e.g. `calls.all(x.state_reverted == true)`), there is still the transaction
       *  fee that are recorded to the chain.
       *
       *  Refer to [TransactionTrace#status] field for more details about the handling you must
       *  perform.
       */
      public state_reverted: bool;
      public begin_ordinal: u64;
      public end_ordinal: u64;
      public account_creations: Array<AccountCreation> =
        new Array<AccountCreation>();

      // Decodes Call from an ArrayBuffer
      static decode(buf: ArrayBuffer): Call {
        return Call.decodeDataView(new DataView(buf));
      }

      // Decodes Call from a DataView
      static decodeDataView(view: DataView): Call {
        const decoder = new __proto.Decoder(view);
        const obj = new Call();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.index = decoder.uint32();
              break;
            }
            case 2: {
              obj.parent_index = decoder.uint32();
              break;
            }
            case 3: {
              obj.depth = decoder.uint32();
              break;
            }
            case 4: {
              obj.call_type = decoder.uint32();
              break;
            }
            case 5: {
              obj.caller = decoder.bytes();
              break;
            }
            case 6: {
              obj.address = decoder.bytes();
              break;
            }
            case 7: {
              const length = decoder.uint32();
              obj.value = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 8: {
              obj.gas_limit = decoder.uint64();
              break;
            }
            case 9: {
              obj.gas_consumed = decoder.uint64();
              break;
            }
            case 13: {
              obj.return_data = decoder.bytes();
              break;
            }
            case 14: {
              obj.input = decoder.bytes();
              break;
            }
            case 15: {
              obj.executed_code = decoder.bool();
              break;
            }
            case 16: {
              obj.suicide = decoder.bool();
              break;
            }
            case 20: {
              const length = decoder.uint32();
              __decodeMap_string_string(decoder, length, obj.keccak_preimages);
              decoder.skip(length);

              break;
            }
            case 21: {
              const length = decoder.uint32();
              obj.storage_changes.push(
                StorageChange.decodeDataView(
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
            case 22: {
              const length = decoder.uint32();
              obj.balance_changes.push(
                BalanceChange.decodeDataView(
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
            case 24: {
              const length = decoder.uint32();
              obj.nonce_changes.push(
                NonceChange.decodeDataView(
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
            case 25: {
              const length = decoder.uint32();
              obj.logs.push(
                Log.decodeDataView(
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
            case 26: {
              const length = decoder.uint32();
              obj.code_changes.push(
                CodeChange.decodeDataView(
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
            case 28: {
              const length = decoder.uint32();
              obj.gas_changes.push(
                GasChange.decodeDataView(
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
            case 10: {
              obj.status_failed = decoder.bool();
              break;
            }
            case 12: {
              obj.status_reverted = decoder.bool();
              break;
            }
            case 11: {
              obj.failure_reason = decoder.string();
              break;
            }
            case 30: {
              obj.state_reverted = decoder.bool();
              break;
            }
            case 31: {
              obj.begin_ordinal = decoder.uint64();
              break;
            }
            case 32: {
              obj.end_ordinal = decoder.uint64();
              break;
            }
            case 33: {
              const length = decoder.uint32();
              obj.account_creations.push(
                AccountCreation.decodeDataView(
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
      } // decode Call

      public size(): u32 {
        let size: u32 = 0;

        size += this.index == 0 ? 0 : 1 + __proto.Sizer.uint32(this.index);
        size +=
          this.parent_index == 0
            ? 0
            : 1 + __proto.Sizer.uint32(this.parent_index);
        size += this.depth == 0 ? 0 : 1 + __proto.Sizer.uint32(this.depth);
        size +=
          this.call_type == 0 ? 0 : 1 + __proto.Sizer.uint32(this.call_type);
        size +=
          this.caller.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.caller.length) +
              this.caller.length
            : 0;
        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;

        if (this.value != null) {
          const f: BigInt = this.value as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size +=
          this.gas_limit == 0 ? 0 : 1 + __proto.Sizer.uint64(this.gas_limit);
        size +=
          this.gas_consumed == 0
            ? 0
            : 1 + __proto.Sizer.uint64(this.gas_consumed);
        size +=
          this.return_data.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.return_data.length) +
              this.return_data.length
            : 0;
        size +=
          this.input.length > 0
            ? 1 + __proto.Sizer.varint64(this.input.length) + this.input.length
            : 0;
        size += this.executed_code == 0 ? 0 : 1 + 1;
        size += this.suicide == 0 ? 0 : 2 + 1;

        if (this.keccak_preimages.size > 0) {
          const keys = this.keccak_preimages.keys();

          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = this.keccak_preimages.get(key);
            const itemSize = __sizeMapEntry_string_string(key, value);
            if (itemSize > 0) {
              size += 2 + __proto.Sizer.varint64(itemSize) + itemSize;
            }
          }
        }

        for (let n: i32 = 0; n < this.storage_changes.length; n++) {
          const messageSize = this.storage_changes[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.balance_changes.length; n++) {
          const messageSize = this.balance_changes[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.nonce_changes.length; n++) {
          const messageSize = this.nonce_changes[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.logs.length; n++) {
          const messageSize = this.logs[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.code_changes.length; n++) {
          const messageSize = this.code_changes[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        for (let n: i32 = 0; n < this.gas_changes.length; n++) {
          const messageSize = this.gas_changes[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size += this.status_failed == 0 ? 0 : 1 + 1;
        size += this.status_reverted == 0 ? 0 : 1 + 1;
        size +=
          this.failure_reason.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.failure_reason.length) +
              this.failure_reason.length
            : 0;
        size += this.state_reverted == 0 ? 0 : 2 + 1;
        size +=
          this.begin_ordinal == 0
            ? 0
            : 2 + __proto.Sizer.uint64(this.begin_ordinal);
        size +=
          this.end_ordinal == 0
            ? 0
            : 2 + __proto.Sizer.uint64(this.end_ordinal);

        for (let n: i32 = 0; n < this.account_creations.length; n++) {
          const messageSize = this.account_creations[n].size();

          if (messageSize > 0) {
            size += 2 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        return size;
      }

      // Encodes Call to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes Call to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.index != 0) {
          encoder.uint32(0x8);
          encoder.uint32(this.index);
        }
        if (this.parent_index != 0) {
          encoder.uint32(0x10);
          encoder.uint32(this.parent_index);
        }
        if (this.depth != 0) {
          encoder.uint32(0x18);
          encoder.uint32(this.depth);
        }
        if (this.call_type != 0) {
          encoder.uint32(0x20);
          encoder.uint32(this.call_type);
        }
        if (this.caller.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.caller.length);
          encoder.bytes(this.caller);
        }
        if (this.address.length > 0) {
          encoder.uint32(0x32);
          encoder.uint32(this.address.length);
          encoder.bytes(this.address);
        }

        if (this.value != null) {
          const f = this.value as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x3a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.gas_limit != 0) {
          encoder.uint32(0x40);
          encoder.uint64(this.gas_limit);
        }
        if (this.gas_consumed != 0) {
          encoder.uint32(0x48);
          encoder.uint64(this.gas_consumed);
        }
        if (this.return_data.length > 0) {
          encoder.uint32(0x6a);
          encoder.uint32(this.return_data.length);
          encoder.bytes(this.return_data);
        }
        if (this.input.length > 0) {
          encoder.uint32(0x72);
          encoder.uint32(this.input.length);
          encoder.bytes(this.input);
        }
        if (this.executed_code != 0) {
          encoder.uint32(0x78);
          encoder.bool(this.executed_code);
        }
        if (this.suicide != 0) {
          encoder.uint32(0x80);
          encoder.bool(this.suicide);
        }

        if (this.keccak_preimages.size > 0) {
          const keys = this.keccak_preimages.keys();
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = this.keccak_preimages.get(key);
            const size = __sizeMapEntry_string_string(key, value);
            if (size > 0) {
              encoder.uint32(0xa2);
              encoder.uint32(size);
              if (key.length > 0) {
                encoder.uint32(0xa);
                encoder.uint32(key.length);
                encoder.string(key);
              }
              if (value.length > 0) {
                encoder.uint32(0x12);
                encoder.uint32(value.length);
                encoder.string(value);
              }
            }
          }
        }

        for (let n: i32 = 0; n < this.storage_changes.length; n++) {
          const messageSize = this.storage_changes[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xaa);
            encoder.uint32(messageSize);
            this.storage_changes[n].encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.balance_changes.length; n++) {
          const messageSize = this.balance_changes[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xb2);
            encoder.uint32(messageSize);
            this.balance_changes[n].encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.nonce_changes.length; n++) {
          const messageSize = this.nonce_changes[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xc2);
            encoder.uint32(messageSize);
            this.nonce_changes[n].encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.logs.length; n++) {
          const messageSize = this.logs[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xca);
            encoder.uint32(messageSize);
            this.logs[n].encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.code_changes.length; n++) {
          const messageSize = this.code_changes[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xd2);
            encoder.uint32(messageSize);
            this.code_changes[n].encodeU8Array(encoder);
          }
        }

        for (let n: i32 = 0; n < this.gas_changes.length; n++) {
          const messageSize = this.gas_changes[n].size();

          if (messageSize > 0) {
            encoder.uint32(0xe2);
            encoder.uint32(messageSize);
            this.gas_changes[n].encodeU8Array(encoder);
          }
        }

        if (this.status_failed != 0) {
          encoder.uint32(0x50);
          encoder.bool(this.status_failed);
        }
        if (this.status_reverted != 0) {
          encoder.uint32(0x60);
          encoder.bool(this.status_reverted);
        }
        if (this.failure_reason.length > 0) {
          encoder.uint32(0x5a);
          encoder.uint32(this.failure_reason.length);
          encoder.string(this.failure_reason);
        }
        if (this.state_reverted != 0) {
          encoder.uint32(0xf0);
          encoder.bool(this.state_reverted);
        }
        if (this.begin_ordinal != 0) {
          encoder.uint32(0xf8);
          encoder.uint64(this.begin_ordinal);
        }
        if (this.end_ordinal != 0) {
          encoder.uint32(0x100);
          encoder.uint64(this.end_ordinal);
        }

        for (let n: i32 = 0; n < this.account_creations.length; n++) {
          const messageSize = this.account_creations[n].size();

          if (messageSize > 0) {
            encoder.uint32(0x10a);
            encoder.uint32(messageSize);
            this.account_creations[n].encodeU8Array(encoder);
          }
        }

        return buf;
      } // encode Call
    } // Call

    export class StorageChange {
      public address: Array<u8> = new Array<u8>();
      public key: Array<u8> = new Array<u8>();
      public old_value: Array<u8> = new Array<u8>();
      public new_value: Array<u8> = new Array<u8>();
      public ordinal: u64;

      // Decodes StorageChange from an ArrayBuffer
      static decode(buf: ArrayBuffer): StorageChange {
        return StorageChange.decodeDataView(new DataView(buf));
      }

      // Decodes StorageChange from a DataView
      static decodeDataView(view: DataView): StorageChange {
        const decoder = new __proto.Decoder(view);
        const obj = new StorageChange();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.address = decoder.bytes();
              break;
            }
            case 2: {
              obj.key = decoder.bytes();
              break;
            }
            case 3: {
              obj.old_value = decoder.bytes();
              break;
            }
            case 4: {
              obj.new_value = decoder.bytes();
              break;
            }
            case 5: {
              obj.ordinal = decoder.uint64();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode StorageChange

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;
        size +=
          this.key.length > 0
            ? 1 + __proto.Sizer.varint64(this.key.length) + this.key.length
            : 0;
        size +=
          this.old_value.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.old_value.length) +
              this.old_value.length
            : 0;
        size +=
          this.new_value.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.new_value.length) +
              this.new_value.length
            : 0;
        size += this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

        return size;
      }

      // Encodes StorageChange to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes StorageChange to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.address.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.address.length);
          encoder.bytes(this.address);
        }
        if (this.key.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.key.length);
          encoder.bytes(this.key);
        }
        if (this.old_value.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.old_value.length);
          encoder.bytes(this.old_value);
        }
        if (this.new_value.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.new_value.length);
          encoder.bytes(this.new_value);
        }
        if (this.ordinal != 0) {
          encoder.uint32(0x28);
          encoder.uint64(this.ordinal);
        }

        return buf;
      } // encode StorageChange
    } // StorageChange

    export class BalanceChange {
      public address: Array<u8> = new Array<u8>();
      public old_value: BigInt = new BigInt();
      public new_value: BigInt = new BigInt();
      public reason: u32;
      public ordinal: u64;

      // Decodes BalanceChange from an ArrayBuffer
      static decode(buf: ArrayBuffer): BalanceChange {
        return BalanceChange.decodeDataView(new DataView(buf));
      }

      // Decodes BalanceChange from a DataView
      static decodeDataView(view: DataView): BalanceChange {
        const decoder = new __proto.Decoder(view);
        const obj = new BalanceChange();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.address = decoder.bytes();
              break;
            }
            case 2: {
              const length = decoder.uint32();
              obj.old_value = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 3: {
              const length = decoder.uint32();
              obj.new_value = BigInt.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 4: {
              obj.reason = decoder.uint32();
              break;
            }
            case 5: {
              obj.ordinal = decoder.uint64();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode BalanceChange

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;

        if (this.old_value != null) {
          const f: BigInt = this.old_value as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        if (this.new_value != null) {
          const f: BigInt = this.new_value as BigInt;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size += this.reason == 0 ? 0 : 1 + __proto.Sizer.uint32(this.reason);
        size += this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

        return size;
      }

      // Encodes BalanceChange to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes BalanceChange to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.address.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.address.length);
          encoder.bytes(this.address);
        }

        if (this.old_value != null) {
          const f = this.old_value as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x12);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.new_value != null) {
          const f = this.new_value as BigInt;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.reason != 0) {
          encoder.uint32(0x20);
          encoder.uint32(this.reason);
        }
        if (this.ordinal != 0) {
          encoder.uint32(0x28);
          encoder.uint64(this.ordinal);
        }

        return buf;
      } // encode BalanceChange
    } // BalanceChange

    /**
     * Obtain all balanche change reasons under deep mind repository:
     *
     *  ```shell
     *  ack -ho 'BalanceChangeReason\(".*"\)' | grep -Eo '".*"' | sort | uniq
     *  ```
     */
    export enum BalanceChange_Reason {
      REASON_UNKNOWN = 0,
      REASON_REWARD_MINE_UNCLE = 1,
      REASON_REWARD_MINE_BLOCK = 2,
      REASON_DAO_REFUND_CONTRACT = 3,
      REASON_DAO_ADJUST_BALANCE = 4,
      REASON_TRANSFER = 5,
      REASON_GENESIS_BALANCE = 6,
      REASON_GAS_BUY = 7,
      REASON_REWARD_TRANSACTION_FEE = 8,
      REASON_REWARD_FEE_RESET = 14,
      REASON_GAS_REFUND = 9,
      REASON_TOUCH_ACCOUNT = 10,
      REASON_SUICIDE_REFUND = 11,
      REASON_SUICIDE_WITHDRAW = 13,
      REASON_CALL_BALANCE_OVERRIDE = 12,
      // Used on chain(s) where some Ether burning happens
      REASON_BURN = 15,
      REASON_WITHDRAWAL = 16,
    } // BalanceChange_Reason
    export class NonceChange {
      public address: Array<u8> = new Array<u8>();
      public old_value: u64;
      public new_value: u64;
      public ordinal: u64;

      // Decodes NonceChange from an ArrayBuffer
      static decode(buf: ArrayBuffer): NonceChange {
        return NonceChange.decodeDataView(new DataView(buf));
      }

      // Decodes NonceChange from a DataView
      static decodeDataView(view: DataView): NonceChange {
        const decoder = new __proto.Decoder(view);
        const obj = new NonceChange();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.address = decoder.bytes();
              break;
            }
            case 2: {
              obj.old_value = decoder.uint64();
              break;
            }
            case 3: {
              obj.new_value = decoder.uint64();
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
      } // decode NonceChange

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;
        size +=
          this.old_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.old_value);
        size +=
          this.new_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.new_value);
        size += this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

        return size;
      }

      // Encodes NonceChange to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes NonceChange to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.address.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.address.length);
          encoder.bytes(this.address);
        }
        if (this.old_value != 0) {
          encoder.uint32(0x10);
          encoder.uint64(this.old_value);
        }
        if (this.new_value != 0) {
          encoder.uint32(0x18);
          encoder.uint64(this.new_value);
        }
        if (this.ordinal != 0) {
          encoder.uint32(0x20);
          encoder.uint64(this.ordinal);
        }

        return buf;
      } // encode NonceChange
    } // NonceChange

    export class AccountCreation {
      public account: Array<u8> = new Array<u8>();
      public ordinal: u64;

      // Decodes AccountCreation from an ArrayBuffer
      static decode(buf: ArrayBuffer): AccountCreation {
        return AccountCreation.decodeDataView(new DataView(buf));
      }

      // Decodes AccountCreation from a DataView
      static decodeDataView(view: DataView): AccountCreation {
        const decoder = new __proto.Decoder(view);
        const obj = new AccountCreation();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.account = decoder.bytes();
              break;
            }
            case 2: {
              obj.ordinal = decoder.uint64();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode AccountCreation

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.account.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.account.length) +
              this.account.length
            : 0;
        size += this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

        return size;
      }

      // Encodes AccountCreation to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes AccountCreation to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.account.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.account.length);
          encoder.bytes(this.account);
        }
        if (this.ordinal != 0) {
          encoder.uint32(0x10);
          encoder.uint64(this.ordinal);
        }

        return buf;
      } // encode AccountCreation
    } // AccountCreation

    export class CodeChange {
      public address: Array<u8> = new Array<u8>();
      public old_hash: Array<u8> = new Array<u8>();
      public old_code: Array<u8> = new Array<u8>();
      public new_hash: Array<u8> = new Array<u8>();
      public new_code: Array<u8> = new Array<u8>();
      public ordinal: u64;

      // Decodes CodeChange from an ArrayBuffer
      static decode(buf: ArrayBuffer): CodeChange {
        return CodeChange.decodeDataView(new DataView(buf));
      }

      // Decodes CodeChange from a DataView
      static decodeDataView(view: DataView): CodeChange {
        const decoder = new __proto.Decoder(view);
        const obj = new CodeChange();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.address = decoder.bytes();
              break;
            }
            case 2: {
              obj.old_hash = decoder.bytes();
              break;
            }
            case 3: {
              obj.old_code = decoder.bytes();
              break;
            }
            case 4: {
              obj.new_hash = decoder.bytes();
              break;
            }
            case 5: {
              obj.new_code = decoder.bytes();
              break;
            }
            case 6: {
              obj.ordinal = decoder.uint64();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode CodeChange

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.address.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.address.length) +
              this.address.length
            : 0;
        size +=
          this.old_hash.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.old_hash.length) +
              this.old_hash.length
            : 0;
        size +=
          this.old_code.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.old_code.length) +
              this.old_code.length
            : 0;
        size +=
          this.new_hash.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.new_hash.length) +
              this.new_hash.length
            : 0;
        size +=
          this.new_code.length > 0
            ? 1 +
              __proto.Sizer.varint64(this.new_code.length) +
              this.new_code.length
            : 0;
        size += this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

        return size;
      }

      // Encodes CodeChange to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes CodeChange to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.address.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.address.length);
          encoder.bytes(this.address);
        }
        if (this.old_hash.length > 0) {
          encoder.uint32(0x12);
          encoder.uint32(this.old_hash.length);
          encoder.bytes(this.old_hash);
        }
        if (this.old_code.length > 0) {
          encoder.uint32(0x1a);
          encoder.uint32(this.old_code.length);
          encoder.bytes(this.old_code);
        }
        if (this.new_hash.length > 0) {
          encoder.uint32(0x22);
          encoder.uint32(this.new_hash.length);
          encoder.bytes(this.new_hash);
        }
        if (this.new_code.length > 0) {
          encoder.uint32(0x2a);
          encoder.uint32(this.new_code.length);
          encoder.bytes(this.new_code);
        }
        if (this.ordinal != 0) {
          encoder.uint32(0x30);
          encoder.uint64(this.ordinal);
        }

        return buf;
      } // encode CodeChange
    } // CodeChange

    /**
     * The gas change model represents the reason why some gas cost has occurred.
     *  The gas is computed per actual op codes. Doing them completely might prove
     *  overwhelming in most cases.
     *
     *  Hence, we only index some of them, those that are costy like all the calls
     *  one, log events, return data, etc.
     */
    export class GasChange {
      public old_value: u64;
      public new_value: u64;
      public reason: u32;
      public ordinal: u64;

      // Decodes GasChange from an ArrayBuffer
      static decode(buf: ArrayBuffer): GasChange {
        return GasChange.decodeDataView(new DataView(buf));
      }

      // Decodes GasChange from a DataView
      static decodeDataView(view: DataView): GasChange {
        const decoder = new __proto.Decoder(view);
        const obj = new GasChange();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.old_value = decoder.uint64();
              break;
            }
            case 2: {
              obj.new_value = decoder.uint64();
              break;
            }
            case 3: {
              obj.reason = decoder.uint32();
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
      } // decode GasChange

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.old_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.old_value);
        size +=
          this.new_value == 0 ? 0 : 1 + __proto.Sizer.uint64(this.new_value);
        size += this.reason == 0 ? 0 : 1 + __proto.Sizer.uint32(this.reason);
        size += this.ordinal == 0 ? 0 : 1 + __proto.Sizer.uint64(this.ordinal);

        return size;
      }

      // Encodes GasChange to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes GasChange to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.old_value != 0) {
          encoder.uint32(0x8);
          encoder.uint64(this.old_value);
        }
        if (this.new_value != 0) {
          encoder.uint32(0x10);
          encoder.uint64(this.new_value);
        }
        if (this.reason != 0) {
          encoder.uint32(0x18);
          encoder.uint32(this.reason);
        }
        if (this.ordinal != 0) {
          encoder.uint32(0x20);
          encoder.uint64(this.ordinal);
        }

        return buf;
      } // encode GasChange
    } // GasChange

    /**
     * Obtain all gas change reasons under deep mind repository:
     *
     *  ```shell
     *  ack -ho 'GasChangeReason\(".*"\)' | grep -Eo '".*"' | sort | uniq
     *  ```
     */
    export enum GasChange_Reason {
      REASON_UNKNOWN = 0,
      // REASON_CALL is the amount of gas that will be charged for a 'CALL' opcode executed by the EVM
      REASON_CALL = 1,
      // REASON_CALL_CODE is the amount of gas that will be charged for a 'CALLCODE' opcode executed by the EVM
      REASON_CALL_CODE = 2,
      // REASON_CALL_DATA_COPY is the amount of gas that will be charged for a 'CALLDATACOPY' opcode executed by the EVM
      REASON_CALL_DATA_COPY = 3,
      // REASON_CODE_COPY is the amount of gas that will be charged for a 'CALLDATACOPY' opcode executed by the EVM
      REASON_CODE_COPY = 4,
      // REASON_CODE_STORAGE is the amount of gas that will be charged for code storage
      REASON_CODE_STORAGE = 5,
      /**
       * REASON_CONTRACT_CREATION is the amount of gas that will be charged for a 'CREATE' opcode executed by the EVM and for the gas
       *  burned for a CREATE, today controlled by EIP150 rules
       */
      REASON_CONTRACT_CREATION = 6,
      /**
       * REASON_CONTRACT_CREATION2 is the amount of gas that will be charged for a 'CREATE2' opcode executed by the EVM and for the gas
       *  burned for a CREATE2, today controlled by EIP150 rules
       */
      REASON_CONTRACT_CREATION2 = 7,
      // REASON_DELEGATE_CALL is the amount of gas that will be charged for a 'DELEGATECALL' opcode executed by the EVM
      REASON_DELEGATE_CALL = 8,
      // REASON_EVENT_LOG is the amount of gas that will be charged for a 'LOG<N>' opcode executed by the EVM
      REASON_EVENT_LOG = 9,
      // REASON_EXT_CODE_COPY is the amount of gas that will be charged for a 'LOG<N>' opcode executed by the EVM
      REASON_EXT_CODE_COPY = 10,
      // REASON_FAILED_EXECUTION is the burning of the remaining gas when the execution failed without a revert
      REASON_FAILED_EXECUTION = 11,
      /**
       * REASON_INTRINSIC_GAS is the amount of gas that will be charged for the intrinsic cost of the transaction, there is
       *  always exactly one of those per transaction
       */
      REASON_INTRINSIC_GAS = 12,
      // GasChangePrecompiledContract is the amount of gas that will be charged for a precompiled contract execution
      REASON_PRECOMPILED_CONTRACT = 13,
      /**
       * REASON_REFUND_AFTER_EXECUTION is the amount of gas that will be refunded to the caller after the execution of the call,
       *  if there is left over at the end of execution
       */
      REASON_REFUND_AFTER_EXECUTION = 14,
      // REASON_RETURN is the amount of gas that will be charged for a 'RETURN' opcode executed by the EVM
      REASON_RETURN = 15,
      // REASON_RETURN_DATA_COPY is the amount of gas that will be charged for a 'RETURNDATACOPY' opcode executed by the EVM
      REASON_RETURN_DATA_COPY = 16,
      // REASON_REVERT is the amount of gas that will be charged for a 'REVERT' opcode executed by the EVM
      REASON_REVERT = 17,
      // REASON_SELF_DESTRUCT is the amount of gas that will be charged for a 'SELFDESTRUCT' opcode executed by the EVM
      REASON_SELF_DESTRUCT = 18,
      // REASON_STATIC_CALL is the amount of gas that will be charged for a 'STATICALL' opcode executed by the EVM
      REASON_STATIC_CALL = 19,
      /**
       * REASON_STATE_COLD_ACCESS is the amount of gas that will be charged for a cold storage access as controlled by EIP2929 rules
       *
       *  Added in Berlin fork (Geth 1.10+)
       */
      REASON_STATE_COLD_ACCESS = 20,
      /**
       * REASON_TX_INITIAL_BALANCE is the initial balance for the call which will be equal to the gasLimit of the call
       *
       *  Added as new tracing reason in Geth, available only on some chains
       */
      REASON_TX_INITIAL_BALANCE = 21,
      /**
       * REASON_TX_REFUNDS is the sum of all refunds which happened during the tx execution (e.g. storage slot being cleared)
       *  this generates an increase in gas. There is only one such gas change per transaction.
       *
       *  Added as new tracing reason in Geth, available only on some chains
       */
      REASON_TX_REFUNDS = 22,
      /**
       * REASON_TX_LEFT_OVER_RETURNED is the amount of gas left over at the end of transaction's execution that will be returned
       *  to the chain. This change will always be a negative change as we "drain" left over gas towards 0. If there was no gas
       *  left at the end of execution, no such even will be emitted. The returned gas's value in Wei is returned to caller.
       *  There is at most one of such gas change per transaction.
       *
       *  Added as new tracing reason in Geth, available only on some chains
       */
      REASON_TX_LEFT_OVER_RETURNED = 23,
      /**
       * REASON_CALL_INITIAL_BALANCE is the initial balance for the call which will be equal to the gasLimit of the call. There is only
       *  one such gas change per call.
       *
       *  Added as new tracing reason in Geth, available only on some chains
       */
      REASON_CALL_INITIAL_BALANCE = 24,
      /**
       * REASON_CALL_LEFT_OVER_RETURNED is the amount of gas left over that will be returned to the caller, this change will always
       *  be a negative change as we "drain" left over gas towards 0. If there was no gas left at the end of execution, no such even
       *  will be emitted.
       */
      REASON_CALL_LEFT_OVER_RETURNED = 25,
    } // GasChange_Reason
    /**
     * HeaderOnlyBlock is used to optimally unpack the [Block] structure (note the
     *  corresponding message number for the `header` field) while consuming less
     *  memory, when only the `header` is desired.
     *
     *  WARN: this is a client-side optimization pattern and should be moved in the
     *  consuming code.
     */
    export class HeaderOnlyBlock {
      public header: BlockHeader = new BlockHeader();

      // Decodes HeaderOnlyBlock from an ArrayBuffer
      static decode(buf: ArrayBuffer): HeaderOnlyBlock {
        return HeaderOnlyBlock.decodeDataView(new DataView(buf));
      }

      // Decodes HeaderOnlyBlock from a DataView
      static decodeDataView(view: DataView): HeaderOnlyBlock {
        const decoder = new __proto.Decoder(view);
        const obj = new HeaderOnlyBlock();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 5: {
              const length = decoder.uint32();
              obj.header = BlockHeader.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
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
      } // decode HeaderOnlyBlock

      public size(): u32 {
        let size: u32 = 0;

        if (this.header != null) {
          const f: BlockHeader = this.header as BlockHeader;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        return size;
      }

      // Encodes HeaderOnlyBlock to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes HeaderOnlyBlock to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.header != null) {
          const f = this.header as BlockHeader;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x2a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        return buf;
      } // encode HeaderOnlyBlock
    } // HeaderOnlyBlock

    /**
     * BlockWithRefs is a lightweight block, with traces and transactions
     *  purged from the `block` within, and only.  It is used in transports
     *  to pass block data around.
     */
    export class BlockWithRefs {
      public id: string = "";
      public block: Block = new Block();
      public transaction_trace_refs: TransactionRefs = new TransactionRefs();
      public irreversible: bool;

      // Decodes BlockWithRefs from an ArrayBuffer
      static decode(buf: ArrayBuffer): BlockWithRefs {
        return BlockWithRefs.decodeDataView(new DataView(buf));
      }

      // Decodes BlockWithRefs from a DataView
      static decodeDataView(view: DataView): BlockWithRefs {
        const decoder = new __proto.Decoder(view);
        const obj = new BlockWithRefs();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.id = decoder.string();
              break;
            }
            case 2: {
              const length = decoder.uint32();
              obj.block = Block.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 3: {
              const length = decoder.uint32();
              obj.transaction_trace_refs = TransactionRefs.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 4: {
              obj.irreversible = decoder.bool();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode BlockWithRefs

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.id.length > 0
            ? 1 + __proto.Sizer.varint64(this.id.length) + this.id.length
            : 0;

        if (this.block != null) {
          const f: Block = this.block as Block;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        if (this.transaction_trace_refs != null) {
          const f: TransactionRefs = this
            .transaction_trace_refs as TransactionRefs;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        size += this.irreversible == 0 ? 0 : 1 + 1;

        return size;
      }

      // Encodes BlockWithRefs to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes BlockWithRefs to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.id.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.id.length);
          encoder.string(this.id);
        }

        if (this.block != null) {
          const f = this.block as Block;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x12);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.transaction_trace_refs != null) {
          const f = this.transaction_trace_refs as TransactionRefs;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x1a);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.irreversible != 0) {
          encoder.uint32(0x20);
          encoder.bool(this.irreversible);
        }

        return buf;
      } // encode BlockWithRefs
    } // BlockWithRefs

    export class TransactionTraceWithBlockRef {
      public trace: TransactionTrace = new TransactionTrace();
      public block_ref: BlockRef = new BlockRef();

      // Decodes TransactionTraceWithBlockRef from an ArrayBuffer
      static decode(buf: ArrayBuffer): TransactionTraceWithBlockRef {
        return TransactionTraceWithBlockRef.decodeDataView(new DataView(buf));
      }

      // Decodes TransactionTraceWithBlockRef from a DataView
      static decodeDataView(view: DataView): TransactionTraceWithBlockRef {
        const decoder = new __proto.Decoder(view);
        const obj = new TransactionTraceWithBlockRef();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              const length = decoder.uint32();
              obj.trace = TransactionTrace.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
                )
              );
              decoder.skip(length);

              break;
            }
            case 2: {
              const length = decoder.uint32();
              obj.block_ref = BlockRef.decodeDataView(
                new DataView(
                  decoder.view.buffer,
                  decoder.pos + decoder.view.byteOffset,
                  length
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
      } // decode TransactionTraceWithBlockRef

      public size(): u32 {
        let size: u32 = 0;

        if (this.trace != null) {
          const f: TransactionTrace = this.trace as TransactionTrace;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        if (this.block_ref != null) {
          const f: BlockRef = this.block_ref as BlockRef;
          const messageSize = f.size();

          if (messageSize > 0) {
            size += 1 + __proto.Sizer.varint64(messageSize) + messageSize;
          }
        }

        return size;
      }

      // Encodes TransactionTraceWithBlockRef to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes TransactionTraceWithBlockRef to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.trace != null) {
          const f = this.trace as TransactionTrace;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0xa);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        if (this.block_ref != null) {
          const f = this.block_ref as BlockRef;

          const messageSize = f.size();

          if (messageSize > 0) {
            encoder.uint32(0x12);
            encoder.uint32(messageSize);
            f.encodeU8Array(encoder);
          }
        }

        return buf;
      } // encode TransactionTraceWithBlockRef
    } // TransactionTraceWithBlockRef

    export class TransactionRefs {
      public hashes: Array<Array<u8>> = new Array<Array<u8>>();

      // Decodes TransactionRefs from an ArrayBuffer
      static decode(buf: ArrayBuffer): TransactionRefs {
        return TransactionRefs.decodeDataView(new DataView(buf));
      }

      // Decodes TransactionRefs from a DataView
      static decodeDataView(view: DataView): TransactionRefs {
        const decoder = new __proto.Decoder(view);
        const obj = new TransactionRefs();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.hashes.push(decoder.bytes());
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode TransactionRefs

      public size(): u32 {
        let size: u32 = 0;

        size += __size_bytes_repeated(this.hashes);

        return size;
      }

      // Encodes TransactionRefs to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes TransactionRefs to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.hashes.length > 0) {
          for (let n: i32 = 0; n < this.hashes.length; n++) {
            encoder.uint32(0xa);
            encoder.uint32(this.hashes[n].length);
            encoder.bytes(this.hashes[n]);
          }
        }

        return buf;
      } // encode TransactionRefs
    } // TransactionRefs

    export class BlockRef {
      public hash: Array<u8> = new Array<u8>();
      public number: u64;

      // Decodes BlockRef from an ArrayBuffer
      static decode(buf: ArrayBuffer): BlockRef {
        return BlockRef.decodeDataView(new DataView(buf));
      }

      // Decodes BlockRef from a DataView
      static decodeDataView(view: DataView): BlockRef {
        const decoder = new __proto.Decoder(view);
        const obj = new BlockRef();

        while (!decoder.eof()) {
          const tag = decoder.tag();
          const number = tag >>> 3;

          switch (number) {
            case 1: {
              obj.hash = decoder.bytes();
              break;
            }
            case 2: {
              obj.number = decoder.uint64();
              break;
            }

            default:
              decoder.skipType(tag & 7);
              break;
          }
        }
        return obj;
      } // decode BlockRef

      public size(): u32 {
        let size: u32 = 0;

        size +=
          this.hash.length > 0
            ? 1 + __proto.Sizer.varint64(this.hash.length) + this.hash.length
            : 0;
        size += this.number == 0 ? 0 : 1 + __proto.Sizer.uint64(this.number);

        return size;
      }

      // Encodes BlockRef to the ArrayBuffer
      encode(): ArrayBuffer {
        return changetype<ArrayBuffer>(
          StaticArray.fromArray<u8>(this.encodeU8Array())
        );
      }

      // Encodes BlockRef to the Array<u8>
      encodeU8Array(
        encoder: __proto.Encoder = new __proto.Encoder(new Array<u8>())
      ): Array<u8> {
        const buf = encoder.buf;

        if (this.hash.length > 0) {
          encoder.uint32(0xa);
          encoder.uint32(this.hash.length);
          encoder.bytes(this.hash);
        }
        if (this.number != 0) {
          encoder.uint32(0x10);
          encoder.uint64(this.number);
        }

        return buf;
      } // encode BlockRef
    } // BlockRef
  } // v2
} // sf
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

// __size_uint64_repeated_packed

function __size_uint64_repeated_packed(value: Array<u64>): u32 {
  let size: u32 = 0;

  for (let n: i32 = 0; n < value.length; n++) {
    size += __proto.Sizer.uint64(value[n]);
  }

  return size;
}

// __size_bytes_repeated

function __size_bytes_repeated(value: Array<Array<u8>>): u32 {
  let size: u32 = 0;

  for (let n: i32 = 0; n < value.length; n++) {
    size += 2 + __proto.Sizer.varint64(value[n].length) + value[n].length;
  }

  return size;
}

// __decodeMap_string_string

function __decodeMap_string_string(
  parentDecoder: __proto.Decoder,
  length: i32,
  map: Map<string, string>
): void {
  const decoder = new __proto.Decoder(
    new DataView(
      parentDecoder.view.buffer,
      parentDecoder.pos + parentDecoder.view.byteOffset,
      length
    )
  );

  let key: string = "";
  let value: string = "";

  while (!decoder.eof()) {
    const tag = decoder.tag();
    const number = tag >>> 3;

    switch (number) {
      case 1: {
        key = decoder.string();
        break;
      }

      case 2: {
        value = decoder.string();
        break;
      }

      default:
        decoder.skipType(tag & 7);
        break;
    }
  }
  map.set(key as string, value as string);
}

// __sizeMapEntry_string_string

function __sizeMapEntry_string_string(key: string, value: string): u32 {
  return (
    (key.length > 0 ? 1 + __proto.Sizer.varint64(key.length) + key.length : 0) +
    (value.length > 0
      ? 1 + __proto.Sizer.varint64(value.length) + value.length
      : 0)
  );
}

// __size_string_repeated

function __size_string_repeated(value: Array<string>): u32 {
  let size: u32 = 0;

  for (let n: i32 = 0; n < value.length; n++) {
    size += 1 + __proto.Sizer.varint64(value[n].length) + value[n].length;
  }

  return size;
}
