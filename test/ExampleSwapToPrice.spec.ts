import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { MaxUint256 } from 'ethers/constants'
import { BigNumber, bigNumberify, defaultAbiCoder, formatEther } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './shared/utilities'
import { v2Fixture } from './shared/fixtures'

import ExampleSwapToPrice from '../build/ExampleSwapToPrice.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe.only('ExampleSwapToPrice', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet])

  let token0: Contract
  let token1: Contract
  let pair: Contract
  let swapToPriceExample: Contract
  let router: Contract
  beforeEach(async function() {
    const fixture = await loadFixture(v2Fixture)
    token0 = fixture.token0
    token1 = fixture.token1
    pair = fixture.pair
    router = fixture.router
    swapToPriceExample = await deployContract(wallet, ExampleSwapToPrice, [fixture.router.address], overrides)
  })

  beforeEach('set up price differential of 1:100', async () => {
    await token0.transfer(pair.address, expandTo18Decimals(10))
    await token1.transfer(pair.address, expandTo18Decimals(1000))
    await pair.sync(overrides)
  })

  beforeEach('approve the swap contract to spend any amount of both tokens', async () => {
    await token0.approve(swapToPriceExample.address, MaxUint256)
    await token1.approve(swapToPriceExample.address, MaxUint256)
  })

  it('correct router address', async () => {
    expect(await swapToPriceExample.router()).to.eq(router.address)
  })

  describe('#swapToPrice', () => {
    it('requires non-zero true price inputs', async () => {
      await expect(
        swapToPriceExample.swapToPrice(token0.address, token1.address, 0, 0, wallet.address, MaxUint256)
      ).to.be.revertedWith('ExampleSwapToPrice: ZERO_PRICE')
      await expect(
        swapToPriceExample.swapToPrice(token0.address, token1.address, 10, 0, wallet.address, MaxUint256)
      ).to.be.revertedWith('ExampleSwapToPrice: ZERO_PRICE')
      await expect(
        swapToPriceExample.swapToPrice(token0.address, token1.address, 0, 10, wallet.address, MaxUint256)
      ).to.be.revertedWith('ExampleSwapToPrice: ZERO_PRICE')
    })

    it('moves the price to 1:90', async () => {
      await expect(
        swapToPriceExample.swapToPrice(token0.address, token1.address, 1, 90, wallet.address, MaxUint256, overrides)
      )
        .to.emit(swapToPriceExample, 'SwapToPrice')
        // (1e19 + 526682316179835569) : (1e21 - 49890467170695440744) ~= 1:90
        .withArgs(token0.address, '526682316179835569', token1.address, '49890467170695440744')
    })

    it('moves the price to 1:110', async () => {
      await expect(
        swapToPriceExample.swapToPrice(token1.address, token0.address, 110, 1, wallet.address, MaxUint256, overrides)
      )
        .to.emit(swapToPriceExample, 'SwapToPrice')
        // (1e21 + 47376582963642643588) : (1e19 - 451039908682851138) ~= 1:110
        .withArgs(token1.address, '47376582963642643588', token0.address, '451039908682851138')
    })
  })
})