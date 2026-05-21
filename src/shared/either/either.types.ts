export namespace E {
  export type Left<L> = { readonly tag: 'left'; readonly value: L };
  export type Right<R> = { readonly tag: 'right'; readonly value: R };
  export type Either<L, R> = Left<L> | Right<R>;

  export const right = <L, R>(val: R): Either<L, R> => ({ tag: 'right', value: val });
  export const left = <L, R>(err: L): Either<L, R> => ({ tag: 'left', value: err });

  export const isLeft = <L, R>(either: Either<L, R>): either is Left<L> => either.tag === 'left';
  export const isRight = <L, R>(either: Either<L, R>): either is Right<R> => either.tag === 'right';
}
