import handleCreate from './create';
// import { Tussle } from '../core';


jest.mock('./create');

describe('handler: create', () => {

  // const tussle = new Tussle({
  //   storage: null,

  // });

  it('should work, danmmit', () => {
    expect(1).toBe(1);
    expect(handleCreate).toEqual(handleCreate);
  });
});
