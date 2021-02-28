/* global describe, it, beforeEach */

var assert = require('assert')
var bscript = require('../src/script')
var networks = require('../src/networks')
var fixtures = require('./fixtures/transaction')
var Transaction = require('../src/transaction')

describe('Transaction', function () {
  function fromRaw (raw, noWitness) {
    var tx = new Transaction()
    tx.version = raw.version
    tx.locktime = raw.locktime

    raw.ins.forEach(function (txIn, i) {
      var txHash = Buffer.from(txIn.hash, 'hex')
      var scriptSig

      if (txIn.data) {
        scriptSig = Buffer.from(txIn.data, 'hex')
      } else if (txIn.script) {
        scriptSig = bscript.fromASM(txIn.script)
      }

      tx.addInput(txHash, txIn.index, txIn.sequence, scriptSig)

      if (!noWitness && txIn.witness) {
        var witness = txIn.witness.map(function (x) {
          return Buffer.from(x, 'hex')
        })

        tx.setWitness(i, witness)
      }
    })

    raw.outs.forEach(function (txOut) {
      var script

      if (txOut.data) {
        script = Buffer.from(txOut.data, 'hex')
      } else if (txOut.script) {
        script = bscript.fromASM(txOut.script)
      }

      tx.addOutput(script, txOut.value)
    })

    return tx
  }

  describe('fromBuffer/fromHex', function () {
    function importExport (f) {
      var id = f.id || f.hash
      var txHex = f.hex || f.txHex

      it('imports ' + f.description + ' (' + id + ')', function () {
        var actual = Transaction.fromHex(txHex)

        assert.strictEqual(actual.toHex(), txHex)
      })

      if (f.whex) {
        it('imports ' + f.description + ' (' + id + ') as witness', function () {
          var actual = Transaction.fromHex(f.whex)

          assert.strictEqual(actual.toHex(), f.whex)
        })
      }
    }

    fixtures.valid.forEach(importExport)
    fixtures.hashForSignature.forEach(importExport)
    fixtures.hashForWitnessV0.forEach(importExport)

    fixtures.invalid.fromBuffer.forEach(function (f) {
      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          Transaction.fromHex(f.hex)
        }, new RegExp(f.exception))
      })
    })

    it('.version should be interpreted as an int32le', function () {
      var txHex = 'ffffffff0000ffffffff'
      var tx = Transaction.fromHex(txHex)
      assert.equal(-1, tx.version)
      assert.equal(0xffffffff, tx.locktime)
    })
  })

  describe('fromBuffer/fromHex for Zcash', function () {
    fixtures.zcash.valid.forEach(function (testData) {
      it('imports ' + testData.description, function () {
        const tx = Transaction.fromHex(testData.hex, networks.zcashTest)
        assert.equal(tx.version, testData.version)
        assert.equal(tx.versionGroupId, parseInt(testData.versionGroupId, 16))
        assert.equal(tx.overwintered, testData.overwintered)
        assert.equal(tx.locktime, testData.locktime)
        assert.equal(tx.expiryHeight, testData.expiryHeight)
        assert.equal(tx.ins.length, testData.insLength)
        assert.equal(tx.outs.length, testData.outsLength)
        assert.equal(tx.joinsplits.length, testData.joinsplitsLength)
        assert.equal(tx.joinsplitPubkey.length, testData.joinsplitPubkeyLength)
        assert.equal(tx.joinsplitSig.length, testData.joinsplitSigLength)

        if (testData.valueBalance) {
          assert.equal(tx.valueBalance, testData.valueBalance)
        }
        if (testData.nShieldedSpend > 0) {
          for (var i = 0; i < testData.nShieldedSpend; ++i) {
            assert.equal(tx.vShieldedSpend[i].cv.toString('hex'), testData.vShieldedSpend[i].cv)
            assert.equal(tx.vShieldedSpend[i].anchor.toString('hex'), testData.vShieldedSpend[i].anchor)
            assert.equal(tx.vShieldedSpend[i].nullifier.toString('hex'), testData.vShieldedSpend[i].nullifier)
            assert.equal(tx.vShieldedSpend[i].rk.toString('hex'), testData.vShieldedSpend[i].rk)
            assert.equal(tx.vShieldedSpend[i].zkproof.sA.toString('hex') +
              tx.vShieldedSpend[i].zkproof.sB.toString('hex') +
              tx.vShieldedSpend[i].zkproof.sC.toString('hex'), testData.vShieldedSpend[i].zkproof)
            assert.equal(tx.vShieldedSpend[i].spendAuthSig.toString('hex'), testData.vShieldedSpend[i].spendAuthSig)
          }
        }
      })
    })

    fixtures.zcash.valid.forEach(function (testData) {
      it('exports ' + testData.description, function () {
        const tx = Transaction.fromHex(testData.hex, networks.zcashTest)
        const hexTx = tx.toHex()
        assert.equal(testData.hex, hexTx)
      })
    })

    fixtures.zcash.valid.forEach(function (testData) {
      it('clone ' + testData.description, function () {
        const tx = Transaction.fromHex(testData.hex, networks.zcashTest)
        const clonedTx = tx.clone()
        assert.equal(clonedTx.toHex(), testData.hex)
      })
    })
  })

  describe('fromBuffer/fromHex for Testnet Dash', function () {
    fixtures.dasht.valid.forEach(function (testData) {
      it('imports ' + testData.description, function () {
        const tx = Transaction.fromHex(testData.hex, networks.dashTest)
        assert.equal(tx.version, testData.version)
        if (tx.versionSupportsDashSpecialTransactions()) {
          assert.equal(tx.type, testData.type)
        }
        assert.equal(tx.locktime, testData.locktime)
        assert.equal(tx.ins.length, testData.vin.length)
        assert.equal(tx.outs.length, testData.vout.length)
        if (tx.isDashSpecialTransaction()) {
          assert.equal(tx.extraPayload.toString('hex'), testData.extraPayload)
        }
      })
    })

    fixtures.dasht.valid.forEach(function (testData) {
      it('exports ' + testData.description, function () {
        const tx = Transaction.fromHex(testData.hex, networks.dashTest)
        const hexTx = tx.toHex()
        assert.equal(testData.hex, hexTx)
      })
    })

    fixtures.dasht.valid.forEach(function (testData) {
      it('clone ' + testData.description, function () {
        const tx = Transaction.fromHex(testData.hex, networks.dashTest)
        const clonedTx = tx.clone()
        assert.equal(clonedTx.toHex(), testData.hex)
      })
    })
  })

  describe('getPrevoutHash', function () {
    fixtures.dasht.valid.filter(f => !!f.proRegTx).forEach(function (testData) {
      it('produces the correct inputsHash on ' + testData.description, function () {
        const tx = Transaction.fromHex(testData.hex, networks.dashTest)
        assert.equal(tx.getPrevoutHash(Transaction.SIGHASH_ALL).reverse().toString('hex'), testData.proRegTx.inputsHash)
      })
    })
  })

  describe('toBuffer/toHex', function () {
    fixtures.valid.forEach(function (f) {
      it('exports ' + f.description + ' (' + f.id + ')', function () {
        var actual = fromRaw(f.raw, true)
        assert.strictEqual(actual.toHex(), f.hex)
      })

      if (f.whex) {
        it('exports ' + f.description + ' (' + f.id + ') as witness', function () {
          var wactual = fromRaw(f.raw)
          assert.strictEqual(wactual.toHex(), f.whex)
        })
      }
    })

    it('accepts target Buffer and offset parameters', function () {
      var f = fixtures.valid[0]
      var actual = fromRaw(f.raw)
      var byteLength = actual.byteLength()

      var target = Buffer.alloc(byteLength * 2)
      var a = actual.toBuffer(target, 0)
      var b = actual.toBuffer(target, byteLength)

      assert.strictEqual(a.length, byteLength)
      assert.strictEqual(b.length, byteLength)
      assert.strictEqual(a.toString('hex'), f.hex)
      assert.strictEqual(b.toString('hex'), f.hex)
      assert.deepEqual(a, b)
      assert.deepEqual(a, target.slice(0, byteLength))
      assert.deepEqual(b, target.slice(byteLength))
    })
  })

  describe('hasWitnesses', function () {
    fixtures.valid.forEach(function (f) {
      it('detects if the transaction has witnesses: ' + (f.whex ? 'true' : 'false'), function () {
        assert.strictEqual(Transaction.fromHex(f.whex ? f.whex : f.hex).hasWitnesses(), !!f.whex)
      })
    })
  })

  describe('weight/virtualSize', function () {
    it('computes virtual size', function () {
      fixtures.valid.forEach(function (f) {
        var transaction = Transaction.fromHex(f.whex ? f.whex : f.hex)

        assert.strictEqual(transaction.virtualSize(), f.virtualSize)
      })
    })

    it('computes weight', function () {
      fixtures.valid.forEach(function (f) {
        var transaction = Transaction.fromHex(f.whex ? f.whex : f.hex)

        assert.strictEqual(transaction.weight(), f.weight)
      })
    })
  })

  describe('addInput', function () {
    var prevTxHash
    beforeEach(function () {
      prevTxHash = Buffer.from('ffffffff00ffff000000000000000000000000000000000000000000101010ff', 'hex')
    })

    it('returns an index', function () {
      var tx = new Transaction()
      assert.strictEqual(tx.addInput(prevTxHash, 0), 0)
      assert.strictEqual(tx.addInput(prevTxHash, 0), 1)
    })

    it('defaults to empty script, witness and 0xffffffff SEQUENCE number', function () {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.strictEqual(tx.ins[0].script.length, 0)
      assert.strictEqual(tx.ins[0].witness.length, 0)
      assert.strictEqual(tx.ins[0].sequence, 0xffffffff)
    })

    fixtures.invalid.addInput.forEach(function (f) {
      it('throws on ' + f.exception, function () {
        var tx = new Transaction()
        var hash = Buffer.from(f.hash, 'hex')

        assert.throws(function () {
          tx.addInput(hash, f.index)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('addOutput', function () {
    it('returns an index', function () {
      var tx = new Transaction()
      assert.strictEqual(tx.addOutput(Buffer.alloc(0), 0), 0)
      assert.strictEqual(tx.addOutput(Buffer.alloc(0), 0), 1)
    })
  })

  describe('clone', function () {
    fixtures.valid.forEach(function (f) {
      var actual, expected

      beforeEach(function () {
        expected = Transaction.fromHex(f.hex)
        actual = expected.clone()
      })

      it('should have value equality', function () {
        assert.deepEqual(actual, expected)
      })

      it('should not have reference equality', function () {
        assert.notEqual(actual, expected)
      })
    })
  })

  describe('getHash/getId', function () {
    function verify (f) {
      it('should return the id for ' + f.id + '(' + f.description + ')', function () {
        var tx = Transaction.fromHex(f.whex || f.hex)

        assert.strictEqual(tx.getHash().toString('hex'), f.hash)
        assert.strictEqual(tx.getId(), f.id)
      })
    }

    fixtures.valid.forEach(verify)
  })

  describe('isCoinbase', function () {
    function verify (f) {
      it('should return ' + f.coinbase + ' for ' + f.id + '(' + f.description + ')', function () {
        var tx = Transaction.fromHex(f.hex)

        assert.strictEqual(tx.isCoinbase(), f.coinbase)
      })
    }

    fixtures.valid.forEach(verify)
  })

  describe('hashForSignature', function () {
    it('does not use Witness serialization', function () {
      var randScript = Buffer.from('6a', 'hex')

      var tx = new Transaction()
      tx.addInput(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), 0)
      tx.addOutput(randScript, 5000000000)

      var original = tx.__toBuffer
      tx.__toBuffer = function (a, b, c) {
        if (c !== false) throw new Error('hashForSignature MUST pass false')

        return original.call(this, a, b, c)
      }

      assert.throws(function () {
        tx.__toBuffer(undefined, undefined, true)
      }, /hashForSignature MUST pass false/)

      // assert hashForSignature does not pass false
      assert.doesNotThrow(function () {
        tx.hashForSignature(0, randScript, 1)
      })
    })

    fixtures.hashForSignature.forEach(function (f) {
      it('should return ' + f.hash + ' for ' + (f.description ? ('case "' + f.description + '"') : f.script), function () {
        var tx = Transaction.fromHex(f.txHex)
        var script = bscript.fromASM(f.script)

        assert.strictEqual(tx.hashForSignature(f.inIndex, script, f.type).toString('hex'), f.hash)
      })
    })
  })

  describe('hashForWitnessV0', function () {
    fixtures.hashForWitnessV0.forEach(function (f) {
      it('should return ' + f.hash + ' for ' + (f.description ? ('case "' + f.description + '"') : ''), function () {
        var tx = Transaction.fromHex(f.txHex)
        var script = bscript.fromASM(f.script)

        assert.strictEqual(tx.hashForWitnessV0(f.inIndex, script, f.value, f.type).toString('hex'), f.hash)
      })
    })
  })

  describe('setWitness', function () {
    it('only accepts a a witness stack (Array of Buffers)', function () {
      assert.throws(function () {
        (new Transaction()).setWitness(0, 'foobar')
      }, /Expected property "1" of type \[Buffer], got String "foobar"/)
    })
  })

  describe('hashForZcashSignature', function () {
    fixtures.hashForZcashSignature.valid.forEach(function (testData) {
      it('should return ' + testData.hash + ' for ' + testData.description, function () {
        var network = networks.zcash
        network.consensusBranchId[testData.version] = parseInt(testData.branchId, 16)
        var tx = Transaction.fromHex(testData.txHex, network)
        var script = Buffer.from(testData.script, 'hex')
        var hash = Buffer.from(testData.hash, 'hex')
        hash.reverse()
        hash = hash.toString('hex')

        assert.strictEqual(
          tx.hashForZcashSignature(testData.inIndex, script, testData.value, testData.type).toString('hex'),
          hash)
      })
    })

    fixtures.hashForZcashSignature.invalid.forEach(function (testData) {
      it('should throw on ' + testData.description, function () {
        var tx = Transaction.fromHex(testData.txHex, networks.zcashTest)
        var script = Buffer.from(testData.script, 'hex')

        assert.throws(function () {
          tx.hashForZcashSignature(testData.inIndex, script, testData.value, testData.type)
        }, new RegExp(testData.exception))
      })
    })
  })

  describe('fromBuffer/fromHex and toBuffer/toHex for decred', function () {
    fixtures.decred.valid.forEach(function (testData) {
      it('parses ' + testData.description, function () {
        // Test fromHex.
        const tx = Transaction.fromHex(testData.hex, networks.decred)
        assert.equal(tx.version, testData.version)
        assert.equal(tx.type, testData.type)
        assert.equal(tx.ins.length, testData.insLength)
        assert.equal(tx.outs.length, testData.outsLength)
        assert.equal(tx.locktime, testData.locktime)
        assert.equal(tx.expiry, testData.expiry)
        for (var i = 0; i < tx.ins.length; i++) {
          var hashCopy = Buffer.allocUnsafe(32)
          tx.ins[i].hash.copy(hashCopy)
          assert.equal(hashCopy.reverse().toString('hex'), testData.ins[i].hash)
          assert.equal(tx.ins[i].index, testData.ins[i].index)
          assert.equal(tx.ins[i].tree, testData.ins[i].tree)
          assert.equal(tx.ins[i].sequence, testData.ins[i].sequence)
          if (tx.hasWitnesses()) {
            assert.equal(tx.ins[i].witness.script.toString('hex'), testData.ins[i].script)
            assert.equal(tx.ins[i].witness.value, testData.ins[i].value)
            assert.equal(tx.ins[i].witness.height, testData.ins[i].height)
            assert.equal(tx.ins[i].witness.blockIndex, testData.ins[i].blockIndex)
          }
        }
        for (i = 0; i < tx.outs.length; i++) {
          assert.equal(tx.outs[i].value, testData.outs[i].value)
          assert.equal(tx.outs[i].script.toString('hex'), testData.outs[i].script)
          assert.equal(tx.outs[i].version, testData.outs[i].version)
        }
        // Test toHex.
        const h = tx.toHex()
        assert.equal(h, testData.hex)
      })
    })
    // Test failure modes.
    fixtures.decred.invalid.forEach(function (f) {
      it('throws ' + f.exception + ' for ' + f.description, function () {
        assert.throws(function () {
          Transaction.fromHex(f.hex, networks.decred)
        }, new RegExp(f.exception))
      })
    })
  })
  describe('decred sig hash', function () {
    fixtures.decred.hashforsigvalid.forEach(function (testData) {
      it('valid for ' + testData.name, function () {
        const tx = Transaction.fromHex(testData.tx, networks.decred)
        const hash = tx.hashForDecredSignature(testData.idx, Buffer.from(testData.script, 'hex'), testData.hashType)
        assert.equal(hash.toString('hex'), testData.want)
      })
    })
    fixtures.decred.hashforsiginvalid.forEach(function (testData) {
      it('throws ' + testData.exception + ' for ' + testData.name, function () {
        assert.throws(function () {
          const tx = Transaction.fromHex(testData.tx, networks.decred)
          tx.hashForDecredSignature(testData.idx, Buffer.from(testData.script, 'hex'), testData.hashType)
          Transaction.fromHex(testData.hex, networks.decred)
        }, new RegExp(testData.exception))
      })
    })
  })
})
