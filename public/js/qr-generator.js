/**
 * Pure JavaScript QR Code Generator for HAPPY CONES
 * Supports Canvas, SVG, Data URL, Raw Matrix, and Node PNG output.
 * ISO/IEC 18004 compliant (Versions 1-20, 4-module Quiet Zone, 18-bit BCH Version Info).
 * Fully offline, no external dependencies required.
 */
(function(global) {
  function stringToUtf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        i++;
        code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    }
    return bytes;
  }

  function QR8bitByte(data) {
    this.mode = 4; // 8-bit byte mode
    this.data = String(data);
    this.parsedData = stringToUtf8Bytes(this.data);
  }
  QR8bitByte.prototype = {
    getLength: function() { return this.parsedData.length; },
    write: function(buffer) {
      for (var i = 0; i < this.parsedData.length; i++) {
        buffer.put(this.parsedData[i], 8);
      }
    }
  };

  var QRMath = {
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256),
    glog: function(n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 256) n -= 255;
      return QRMath.EXP_TABLE[n];
    }
  };
  for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (var i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  for (var i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function Poly(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] == 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[offset + i];
    for (var j = num.length - offset; j < this.num.length; j++) this.num[j] = 0;
  }
  Poly.prototype = {
    get: function(index) { return this.num[index]; },
    getLength: function() { return this.num.length; },
    multiply: function(e) {
      var num = new Array(this.getLength() + e.getLength() - 1);
      for (var k = 0; k < num.length; k++) num[k] = 0;
      for (var i = 0; i < this.getLength(); i++) {
        for (var j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new Poly(num, 0);
    },
    mod: function(e) {
      if (this.getLength() - e.getLength() < 0) return this;
      var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      var num = new Array(this.getLength());
      for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (var i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new Poly(num, 0).mod(e);
    }
  };

  var QRRSBlock = {
    // Versions 1-20, each row: L, M, Q, H
    RS_BLOCK_TABLE: [
      // 1
      [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
      // 2
      [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
      // 3
      [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
      // 4
      [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
      // 5
      [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
      // 6
      [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
      // 7
      [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
      // 8
      [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
      // 9
      [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
      // 10
      [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
      // 11
      [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13],
      // 12
      [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15],
      // 13
      [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12],
      // 14
      [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13],
      // 15
      [5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12, 7, 37, 13],
      // 16
      [5, 122, 98, 1, 123, 99], [7, 73, 45, 3, 74, 46], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16],
      // 17
      [1, 135, 107, 5, 136, 108], [10, 74, 46, 1, 75, 47], [1, 50, 22, 15, 51, 23], [2, 42, 14, 17, 43, 15],
      // 18
      [5, 150, 120, 1, 151, 121], [9, 69, 43, 4, 70, 44], [17, 50, 22, 1, 51, 23], [2, 42, 14, 19, 43, 15],
      // 19
      [3, 141, 113, 4, 142, 114], [3, 70, 44, 11, 71, 45], [17, 47, 21, 4, 48, 22], [9, 39, 13, 16, 40, 14],
      // 20
      [3, 135, 107, 5, 136, 108], [3, 67, 41, 13, 68, 42], [15, 54, 24, 5, 55, 25], [15, 43, 15, 10, 44, 16]
    ],
    getRSBlocks: function(typeNumber, errorCorrectLevel) {
      var rsBlock = this.getRsBlockTable(typeNumber, errorCorrectLevel);
      if (rsBlock == undefined) throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
      var length = rsBlock.length / 3;
      var list = [];
      for (var i = 0; i < length; i++) {
        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];
        for (var j = 0; j < count; j++) {
          list.push({ totalCount: totalCount, dataCount: dataCount });
        }
      }
      return list;
    },
    getRsBlockTable: function(typeNumber, errorCorrectLevel) {
      switch (errorCorrectLevel) {
        case 1: return this.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0]; // L
        case 0: return this.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1]; // M
        case 3: return this.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2]; // Q
        case 2: return this.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3]; // H
        default: return undefined;
      }
    }
  };

  var PATTERN_POSITION_TABLE = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90]
  ];

  var QRUtil = {
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
    getBCHDigit: function(data) {
      var digit = 0;
      while (data != 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    },
    getBCHTypeInfo: function(data) {
      var d = data << 10;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
        d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
      }
      return ((data << 10) | d) ^ QRUtil.G15_MASK;
    },
    getBCHTypeNumber: function(data) {
      var d = data << 12;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
        d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
      }
      return (data << 12) | d;
    },
    getLengthInBits: function(mode, type) {
      if (1 <= type && type < 10) {
        if (mode == 4) return 8;
      } else if (type < 27) {
        if (mode == 4) return 16;
      } else if (type < 41) {
        if (mode == 4) return 16;
      }
      throw new Error("mode:" + mode + " type:" + type);
    }
  };

  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype = {
    get: function(index) {
      var bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1;
    },
    put: function(num, length) {
      for (var i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) == 1);
      }
    },
    getLengthInBits: function() { return this.length; },
    putBit: function(bit) {
      var bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  function QRCodeModel(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  QRCodeModel.prototype = {
    addData: function(data) {
      this.dataList.push(new QR8bitByte(data));
      this.dataCache = null;
    },
    isDark: function(row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
        throw new Error(row + "," + col);
      }
      return this.modules[row][col];
    },
    getModuleCount: function() { return this.moduleCount; },
    make: function() {
      if (this.typeNumber < 1) {
        var found = false;
        var typeNumber = 1;
        for (typeNumber = 1; typeNumber <= 20; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
          var buffer = new QRBitBuffer();
          for (var i = 0; i < this.dataList.length; i++) {
            var data = this.dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
            data.write(buffer);
          }
          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            found = true;
            break;
          }
        }
        if (!found) {
          throw new Error("QR data too long (exceeds Version 20 capacity)");
        }
        this.typeNumber = typeNumber;
      }
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl: function(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (var col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.typeNumber >= 7) this.setupTypeNumber(test);
      if (this.dataCache == null) {
        this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
      }
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern: function(row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    getBestMaskPattern: function() {
      var minLostPoint = 0;
      var pattern = 0;
      for (var i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        var lostPoint = this.getLostPoint();
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    },
    setupTimingPattern: function() {
      for (var r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] != null) continue;
        this.modules[r][6] = (r % 2 == 0);
      }
      for (var c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] != null) continue;
        this.modules[6][c] = (c % 2 == 0);
      }
    },
    setupPositionAdjustPattern: function() {
      var pos = PATTERN_POSITION_TABLE[this.typeNumber - 1] || [];
      for (var i = 0; i < pos.length; i++) {
        for (var j = 0; j < pos.length; j++) {
          var row = pos[i];
          var col = pos[j];
          if (this.modules[row][col] != null) continue;
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    },
    setupTypeInfo: function(test, maskPattern) {
      var data = (this.errorCorrectLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;
      }
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = (!test);
    },
    setupTypeNumber: function(test) {
      var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
      for (var i = 0; i < 18; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
      }
      for (var i = 0; i < 18; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    },
    mapData: function(data, maskPattern) {
      var inc = -1;
      var row = this.moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      for (var col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (this.modules[row][col - c] == null) {
              var dark = false;
              if (byteIndex < data.length) {
                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
              }
              var mask = this.getMask(maskPattern, row, col - c);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex == -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    },
    getMask: function(maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 == 0;
        case 1: return i % 2 == 0;
        case 2: return j % 3 == 0;
        case 3: return (i + j) % 3 == 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
        case 5: return (i * j) % 2 + (i * j) % 3 == 0;
        case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
        case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    },
    getLostPoint: function() {
      var moduleCount = this.moduleCount;
      var lostPoint = 0;
      var r, c;

      // LEVEL 1: Horizontal & vertical runs of >= 5 same-colored modules
      for (r = 0; r < moduleCount; r++) {
        var rowRun = 1;
        for (c = 1; c < moduleCount; c++) {
          if (this.isDark(r, c) === this.isDark(r, c - 1)) {
            rowRun++;
          } else {
            if (rowRun >= 5) lostPoint += (3 + rowRun - 5);
            rowRun = 1;
          }
        }
        if (rowRun >= 5) lostPoint += (3 + rowRun - 5);
      }
      for (c = 0; c < moduleCount; c++) {
        var colRun = 1;
        for (r = 1; r < moduleCount; r++) {
          if (this.isDark(r, c) === this.isDark(r - 1, c)) {
            colRun++;
          } else {
            if (colRun >= 5) lostPoint += (3 + colRun - 5);
            colRun = 1;
          }
        }
        if (colRun >= 5) lostPoint += (3 + colRun - 5);
      }

      // LEVEL 2: 2x2 blocks of same color
      for (r = 0; r < moduleCount - 1; r++) {
        for (c = 0; c < moduleCount - 1; c++) {
          var count2 = 0;
          if (this.isDark(r, c)) count2++;
          if (this.isDark(r + 1, c)) count2++;
          if (this.isDark(r, c + 1)) count2++;
          if (this.isDark(r + 1, c + 1)) count2++;
          if (count2 == 0 || count2 == 4) lostPoint += 3;
        }
      }

      // LEVEL 3: 1:1:3:1:1 finder-like patterns padded with 4 light modules
      for (r = 0; r < moduleCount; r++) {
        for (c = 0; c < moduleCount - 10; c++) {
          var hFind = this.isDark(r, c) && !this.isDark(r, c + 1) && this.isDark(r, c + 2) && this.isDark(r, c + 3) && this.isDark(r, c + 4) && !this.isDark(r, c + 5) && this.isDark(r, c + 6);
          if (hFind && !this.isDark(r, c + 7) && !this.isDark(r, c + 8) && !this.isDark(r, c + 9) && !this.isDark(r, c + 10)) lostPoint += 40;
          var hLight = !this.isDark(r, c) && !this.isDark(r, c + 1) && !this.isDark(r, c + 2) && !this.isDark(r, c + 3);
          if (hLight && this.isDark(r, c + 4) && !this.isDark(r, c + 5) && this.isDark(r, c + 6) && this.isDark(r, c + 7) && this.isDark(r, c + 8) && !this.isDark(r, c + 9) && this.isDark(r, c + 10)) lostPoint += 40;
        }
      }
      for (c = 0; c < moduleCount; c++) {
        for (r = 0; r < moduleCount - 10; r++) {
          var vFind = this.isDark(r, c) && !this.isDark(r + 1, c) && this.isDark(r + 2, c) && this.isDark(r + 3, c) && this.isDark(r + 4, c) && !this.isDark(r + 5, c) && this.isDark(r + 6, c);
          if (vFind && !this.isDark(r + 7, c) && !this.isDark(r + 8, c) && !this.isDark(r + 9, c) && !this.isDark(r + 10, c)) lostPoint += 40;
          var vLight = !this.isDark(r, c) && !this.isDark(r + 1, c) && !this.isDark(r + 2, c) && !this.isDark(r + 3, c);
          if (vLight && this.isDark(r + 4, c) && !this.isDark(r + 5, c) && this.isDark(r + 6, c) && this.isDark(r + 7, c) && this.isDark(r + 8, c) && !this.isDark(r + 9, c) && this.isDark(r + 10, c)) lostPoint += 40;
        }
      }

      // LEVEL 4: Dark/light ratio balance
      var darkCount = 0;
      for (c = 0; c < moduleCount; c++) {
        for (r = 0; r < moduleCount; r++) {
          if (this.isDark(r, c)) darkCount++;
        }
      }
      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    }
  };

  QRCodeModel.createData = function(typeNumber, errorCorrectLevel, dataList) {
    var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
    var buffer = new QRBitBuffer();
    for (var i = 0; i < dataList.length; i++) {
      var data = dataList[i];
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
      data.write(buffer);
    }
    var totalDataCount = 0;
    for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw new Error("code length overflow. (" + buffer.getLengthInBits() + ">" + (totalDataCount * 8) + "bit)");
    }
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.getLengthInBits() % 8 != 0) buffer.putBit(false);
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) break;
      buffer.put(0xEC, 8);
      if (buffer.getLengthInBits() >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }
    return QRCodeModel.createBytes(buffer, rsBlocks);
  };

  QRCodeModel.createBytes = function(buffer, rsBlocks) {
    var offset = 0;
    var maxDcCount = 0;
    var maxEcCount = 0;
    var dcdata = new Array(rsBlocks.length);
    var ecdata = new Array(rsBlocks.length);
    for (var r = 0; r < rsBlocks.length; r++) {
      var dcCount = rsBlocks[r].dataCount;
      var ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (var i = 0; i < dcdata[r].length; i++) {
        dcdata[r][i] = 0xff & buffer.buffer[i + offset];
      }
      offset += dcCount;
      var rsPoly = (function(errorCorrectLength) {
        var a = new Poly([1], 0);
        for (var i = 0; i < errorCorrectLength; i++) {
          a = a.multiply(new Poly([1, QRMath.gexp(i)], 0));
        }
        return a;
      })(ecCount);
      var rawPoly = new Poly(dcdata[r], rsPoly.getLength() - 1);
      var modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (var i = 0; i < ecdata[r].length; i++) {
        var modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
      }
    }
    var totalCodeCount = 0;
    for (var i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
    var data = new Array(totalCodeCount);
    var index = 0;
    for (var i = 0; i < maxDcCount; i++) {
      for (var r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (var i = 0; i < maxEcCount; i++) {
      for (var r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  };

  function createQRMatrix(text, options) {
    options = options || {};
    var ecMap = { L: 1, M: 0, Q: 3, H: 2 };
    var ec = (options.errorCorrectLevel !== undefined)
      ? (typeof options.errorCorrectLevel === 'string' ? (ecMap[options.errorCorrectLevel.toUpperCase()] ?? 0) : options.errorCorrectLevel)
      : 0; // Default M
    var qr = new QRCodeModel(0, ec);
    qr.addData(text);
    qr.make();
    return qr;
  }

  // High-Level Helper Functions
  global.generateQRCodeCanvas = function(container, text, options) {
    options = options || {};
    var size = options.size || 240;
    var border = (typeof options.border === 'number') ? options.border : 4; // ISO 18004 4-module quiet zone
    var colorDark = options.colorDark || "#000000";
    var colorLight = options.colorLight || "#ffffff";
    var qr = createQRMatrix(text, options);
    var count = qr.getModuleCount();
    var totalCount = count + border * 2;

    // Integer module scaling centered cleanly on crisp canvas (zero seam/jitter artifacts)
    var modulePx = Math.floor(size / totalCount);
    var canvasSize = size;
    var offsetX = 0;
    var offsetY = 0;
    if (modulePx < 3) {
      modulePx = 3;
      canvasSize = totalCount * modulePx;
    } else {
      offsetX = Math.floor((canvasSize - totalCount * modulePx) / 2);
      offsetY = offsetX;
    }

    var canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    canvas.style.imageRendering = "pixelated";

    var ctx = canvas.getContext("2d");
    ctx.fillStyle = colorLight;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = colorDark;
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(
            offsetX + (c + border) * modulePx,
            offsetY + (r + border) * modulePx,
            modulePx,
            modulePx
          );
        }
      }
    }
    if (typeof container === 'string') container = document.getElementById(container);
    if (container) {
      container.innerHTML = "";
      container.appendChild(canvas);
    }
    return canvas;
  };

  global.generateQRCodeDataURL = function(text, size) {
    var c = document.createElement("div");
    var canvas = global.generateQRCodeCanvas(c, text, { size: size || 260 });
    return canvas.toDataURL("image/png");
  };

  global.generateQRCodeSVG = function(text, options) {
    options = options || {};
    var size = options.size || 320;
    var border = (typeof options.border === 'number') ? options.border : 4; // ISO 18004 4-module quiet zone
    var colorDark = options.colorDark || "#000000";
    var colorLight = options.colorLight || "#ffffff";
    var qr = createQRMatrix(text, options);
    var count = qr.getModuleCount();
    var totalCount = count + border * 2;
    var rects = '';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          rects += '<rect x="' + (c + border) + '" y="' + (r + border) + '" width="1.02" height="1.02" fill="' + colorDark + '"/>\n';
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalCount + ' ' + totalCount + '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges">\n' +
      '<rect width="' + totalCount + '" height="' + totalCount + '" fill="' + colorLight + '"/>\n' +
      rects +
      '</svg>';
  };

  function deflateStoredZlib(raw) {
    var chunkMax = 65535;
    var numChunks = Math.max(1, Math.ceil(raw.length / chunkMax));
    var out = Buffer.alloc(2 + raw.length + numChunks * 5 + 4);
    var pos = 0;
    out[pos++] = 0x78; // CMF: deflate, 32K window
    out[pos++] = 0x01; // FLG: no dict, FCHECK valid mod 31
    var offset = 0;
    for (var idx = 0; idx < numChunks; idx++) {
      var len = Math.min(chunkMax, raw.length - offset);
      out[pos++] = (idx === numChunks - 1) ? 1 : 0; // BFINAL + BTYPE=00
      out.writeUInt16LE(len, pos); pos += 2;
      out.writeUInt16LE(65535 ^ len, pos); pos += 2;
      if (len > 0) {
        raw.copy(out, pos, offset, offset + len);
        pos += len;
      }
      offset += len;
    }
    var s1 = 1;
    var s2 = 0;
    for (var i = 0; i < raw.length; i++) {
      s1 = (s1 + raw[i]) % 65521;
      s2 = (s2 + s1) % 65521;
    }
    out.writeUInt32BE(((s2 << 16) | s1) >>> 0, pos);
    return out;
  }

  // Pure-Node crisp PNG generator (zero external dependencies)
  function generateQRCodePNGBuffer(text, options) {
    options = options || {};
    var deflateFn = (typeof options.deflateSync === 'function') ? options.deflateSync : deflateStoredZlib;
    var size = options.size || 420;
    var border = (typeof options.border === 'number') ? options.border : 4;
    var qr = createQRMatrix(text, options);
    var count = qr.getModuleCount();
    var totalCount = count + border * 2;
    var modulePx = Math.max(4, Math.floor(size / totalCount));
    var actualSize = totalCount * modulePx;
    var pad = Math.max(0, Math.floor((size - actualSize) / 2));
    var width = actualSize + pad * 2;
    var height = width;

    // 8-bit Grayscale PNG (Color Type 0)
    var rowStride = width + 1;
    var raw = Buffer.alloc(rowStride * height, 255);
    for (var y = 0; y < height; y++) {
      raw[y * rowStride] = 0; // Filter type 0 (None)
    }

    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          var startX = pad + (c + border) * modulePx;
          var startY = pad + (r + border) * modulePx;
          for (var dy = 0; dy < modulePx; dy++) {
            var rowStart = (startY + dy) * rowStride + 1 + startX;
            raw.fill(0, rowStart, rowStart + modulePx);
          }
        }
      }
    }

    // CRC32 table
    var crcTable = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var cVal = n;
      for (var k = 0; k < 8; k++) {
        cVal = (cVal & 1) ? (0xedb88320 ^ (cVal >>> 1)) : (cVal >>> 1);
      }
      crcTable[n] = cVal >>> 0;
    }
    function crc32(buf) {
      var crc = 0xffffffff;
      for (var i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    }
    function makeChunk(type, data) {
      var len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      var typeBuf = Buffer.from(type, 'ascii');
      var crcInput = Buffer.concat([typeBuf, data]);
      var crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32BE(crc32(crcInput), 0);
      return Buffer.concat([len, typeBuf, data, crcBuf]);
    }

    var signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    var ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 0; // grayscale
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    var compressed = deflateFn(raw);
    return Buffer.concat([
      signature,
      makeChunk('IHDR', ihdr),
      makeChunk('IDAT', compressed),
      makeChunk('IEND', Buffer.alloc(0))
    ]);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateQRCodeCanvas: global.generateQRCodeCanvas,
      generateQRCodeSVG: global.generateQRCodeSVG,
      generateQRCodePNGBuffer: generateQRCodePNGBuffer,
      createQRMatrix: createQRMatrix
    };
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
